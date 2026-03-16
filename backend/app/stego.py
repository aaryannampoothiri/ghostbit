from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
import hashlib
import random

import numpy as np
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from PIL import Image


BLOCK_SIZE = 8
VARIANCE_QUANTILE = 0.65
HEADER_LEN_BYTES = 4
NONCE_SIZE = 12
TAG_SIZE = 16


@dataclass(frozen=True)
class CapacityResult:
    capacity_bits: int
    capacity_bytes: int
    eligible_pixels: int
    variance_threshold: float
    image_fingerprint: str


@dataclass(frozen=True)
class EmbedResult:
    png_bytes: bytes
    capacity_bits: int
    used_bits: int
    usage_percent: float
    image_fingerprint: str


def _open_rgb_image(image_bytes: bytes) -> Image.Image:
    image = Image.open(BytesIO(image_bytes))
    return image.convert("RGB")


def _image_to_array(image_bytes: bytes) -> np.ndarray:
    image = _open_rgb_image(image_bytes)
    return np.array(image, dtype=np.uint8)


def _stable_image_fingerprint(image_array: np.ndarray) -> str:
    sanitized = image_array.copy()
    sanitized &= 0xFE
    return hashlib.sha256(sanitized.tobytes()).hexdigest()


def _variance_map(image_array: np.ndarray) -> tuple[np.ndarray, float]:
    gray = np.dot(image_array[..., :3], [0.299, 0.587, 0.114]).astype(np.float64)
    height, width = gray.shape
    block_vars: list[float] = []

    for row in range(0, height, BLOCK_SIZE):
        for col in range(0, width, BLOCK_SIZE):
            block = gray[row : row + BLOCK_SIZE, col : col + BLOCK_SIZE]
            if block.size == 0:
                continue
            block_vars.append(float(np.var(block)))

    threshold = float(np.quantile(block_vars, VARIANCE_QUANTILE)) if block_vars else 0.0
    variance_map = np.zeros((height, width), dtype=np.float64)

    idx = 0
    for row in range(0, height, BLOCK_SIZE):
        for col in range(0, width, BLOCK_SIZE):
            block = gray[row : row + BLOCK_SIZE, col : col + BLOCK_SIZE]
            if block.size == 0:
                continue
            variance_map[row : row + block.shape[0], col : col + block.shape[1]] = block_vars[idx]
            idx += 1

    return variance_map, threshold


def _high_entropy_coordinates(image_array: np.ndarray) -> tuple[list[tuple[int, int]], float, str]:
    variance_map, threshold = _variance_map(image_array)
    coordinate_rows = np.argwhere(variance_map >= threshold)
    coordinates = [(int(row), int(col)) for row, col in coordinate_rows]
    image_fingerprint = _stable_image_fingerprint(image_array)
    return coordinates, threshold, image_fingerprint


def _seeded_scatter(coords: list[tuple[int, int]], secret_key: str, image_fingerprint: str) -> list[tuple[int, int]]:
    seed_material = f"{secret_key}:{image_fingerprint}".encode("utf-8")
    seed_digest = hashlib.sha256(seed_material).digest()
    seed = int.from_bytes(seed_digest[:8], byteorder="big", signed=False)
    shuffled = coords.copy()
    random.Random(seed).shuffle(shuffled)
    return shuffled


def _derive_aes_key(secret_key: str) -> bytes:
    return hashlib.sha256(secret_key.encode("utf-8")).digest()


def _encrypt_message(message: str, secret_key: str) -> bytes:
    key = _derive_aes_key(secret_key)
    nonce = get_random_bytes(NONCE_SIZE)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(message.encode("utf-8"))
    return nonce + tag + ciphertext


def _decrypt_message(payload: bytes, secret_key: str) -> str:
    if len(payload) < NONCE_SIZE + TAG_SIZE:
        raise ValueError("Invalid payload length.")

    nonce = payload[:NONCE_SIZE]
    tag = payload[NONCE_SIZE : NONCE_SIZE + TAG_SIZE]
    ciphertext = payload[NONCE_SIZE + TAG_SIZE :]
    key = _derive_aes_key(secret_key)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    plaintext = cipher.decrypt_and_verify(ciphertext, tag)
    return plaintext.decode("utf-8")


def _bytes_to_bits(data: bytes) -> list[int]:
    return [int(bit) for byte in data for bit in f"{byte:08b}"]


def _bits_to_bytes(bits: list[int]) -> bytes:
    if len(bits) % 8 != 0:
        raise ValueError("Bit length must be divisible by 8.")
    byte_values = [int("".join(str(bit) for bit in bits[i : i + 8]), 2) for i in range(0, len(bits), 8)]
    return bytes(byte_values)


def analyze_capacity(image_bytes: bytes) -> CapacityResult:
    image_array = _image_to_array(image_bytes)
    coordinates, threshold, image_fingerprint = _high_entropy_coordinates(image_array)
    capacity_bits = len(coordinates)
    return CapacityResult(
        capacity_bits=capacity_bits,
        capacity_bytes=capacity_bits // 8,
        eligible_pixels=capacity_bits,
        variance_threshold=threshold,
        image_fingerprint=image_fingerprint,
    )


def embed_message(image_bytes: bytes, message: str, secret_key: str) -> EmbedResult:
    image_array = _image_to_array(image_bytes)
    coordinates, _, image_fingerprint = _high_entropy_coordinates(image_array)
    traversal_map = _seeded_scatter(coordinates, secret_key, image_fingerprint)

    encrypted_payload = _encrypt_message(message, secret_key)
    payload = len(encrypted_payload).to_bytes(HEADER_LEN_BYTES, byteorder="big") + encrypted_payload
    payload_bits = _bytes_to_bits(payload)

    if len(payload_bits) > len(traversal_map):
        raise ValueError(
            "Message exceeds entropy-safe capacity. Use a larger/noisier cover image or shorter message."
        )

    for bit, (row, col) in zip(payload_bits, traversal_map):
        image_array[row, col, 2] = (image_array[row, col, 2] & 0xFE) | bit

    output_buffer = BytesIO()
    Image.fromarray(image_array, mode="RGB").save(output_buffer, format="PNG", optimize=False)
    output_bytes = output_buffer.getvalue()

    capacity_bits = len(traversal_map)
    usage_percent = (len(payload_bits) / capacity_bits) * 100 if capacity_bits else 0.0

    return EmbedResult(
        png_bytes=output_bytes,
        capacity_bits=capacity_bits,
        used_bits=len(payload_bits),
        usage_percent=usage_percent,
        image_fingerprint=image_fingerprint,
    )


def extract_message(image_bytes: bytes, secret_key: str) -> str:
    image_array = _image_to_array(image_bytes)
    coordinates, _, image_fingerprint = _high_entropy_coordinates(image_array)
    traversal_map = _seeded_scatter(coordinates, secret_key, image_fingerprint)

    if len(traversal_map) < HEADER_LEN_BYTES * 8:
        raise ValueError("Image does not contain a valid GhostBit payload.")

    header_bits = [image_array[row, col, 2] & 1 for row, col in traversal_map[: HEADER_LEN_BYTES * 8]]
    encrypted_payload_len = int.from_bytes(_bits_to_bytes(header_bits), byteorder="big")

    total_payload_bits = encrypted_payload_len * 8
    start = HEADER_LEN_BYTES * 8
    end = start + total_payload_bits
    if end > len(traversal_map):
        raise ValueError("Payload marker is invalid for this image/key pair.")

    payload_bits = [image_array[row, col, 2] & 1 for row, col in traversal_map[start:end]]
    encrypted_payload = _bits_to_bytes(payload_bits)
    return _decrypt_message(encrypted_payload, secret_key)
