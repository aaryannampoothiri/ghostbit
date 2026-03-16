# GhostBit

A modern, visually stunning steganography platform for encoding and decoding secret messages in images. Built with Next.js, React, Tailwind CSS, and Framer Motion.

## Features

- **Glassmorphism & Emerald Glow**: Premium UI with glassy panels and emerald color palette.
- **Animated Interactions**: Framer Motion micro-interactions, mouse-follow glow, and interactive cards.
- **Drag-and-Drop Encode/Decode**: Effortless workflow for hiding and extracting messages in images.
- **Sticky Blurred Headers**: Consistent navigation with logo and home button.
- **Capacity Meter**: Visual feedback on image encoding capacity.

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, Framer Motion
- **Backend API**: (Expected) FastAPI or similar (API endpoints: `/api/analyze`, `/api/embed`, `/api/extract`)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
 git clone https://github.com/aaryannampoothiri/ghostbit.git
 cd ghostbit/frontend

# Install dependencies
 npm install
# or
yarn install
```

### Development

```bash
# Start the development server
npm run dev
# or
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the app.

### Build for Production

```bash
npm run build
npm start
```

### Environment Variables

Create a `.env.local` file in `frontend/`:

```
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

## Folder Structure

- `frontend/app/` — Next.js app directory (pages, dashboard, components)
- `frontend/components/` — Reusable React components
- `frontend/public/` — Static assets (logo, images)

## Usage

1. **Encode a Message**:
   - Go to the Dashboard.
   - Upload a cover image.
   - Enter your secret message and key.
   - Click **Encode** to generate a stego image.

2. **Decode a Message**:
   - Go to the Dashboard.
   - Upload a stego image.
   - Enter the decode key.
   - Click **Decode** to extract the hidden message.

## Customization

- **Logo**: Replace `frontend/public/logo.png` with your own logo.
- **Colors/Theme**: Edit Tailwind config and component classes for custom branding.

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](LICENSE)
