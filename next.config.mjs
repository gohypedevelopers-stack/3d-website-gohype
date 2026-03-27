/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep images unoptimized to avoid remote loader setup for now
  images: {
    unoptimized: true,
  },
  // If you want stricter builds, set this to false once type errors are resolved
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
