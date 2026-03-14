## Free NYC Portfolio

Next.js App Router portfolio site for Leica-style street photography.

## Website Overview

Free NYC is a street photography portfolio and admin-controlled gallery built to present curated images, captions, poems, and artist information in a clean editorial layout.

The site includes:

- a public homepage with curated featured images
- a gallery with collection-based filtering and lightbox viewing
- an About page with editable artist content
- a contact form for project inquiries
- an admin dashboard for uploads, homepage curation, branding, album management, and drafts

## Tools Used

This website was built with:

- **Next.js 16** for the App Router architecture and full-stack React framework
- **React 19** for the user interface
- **MongoDB Atlas** for photos, site settings, About page content, and contact message storage
- **NextAuth.js** with **Google sign-in** for admin authentication
- **Custom admin gate password** for an extra layer of admin protection
- **Cloudinary** for image hosting, uploads, and delivery
- **Resend** for contact form email delivery
- **Tailwind CSS 4** for styling and design system utilities
- **Netlify** for deployment and hosting

## Contact Email Setup

Contact form submissions are sent by the `/api/contact` route using the Resend API.
Submissions are also saved in MongoDB (`contact_messages` collection) when Mongo is configured.

Required environment variables:

```bash
RESEND_API_KEY=your_resend_api_key
CONTACT_TO_EMAIL=richiecarrasco@pursuit.org
CONTACT_FROM_EMAIL="Free NYC <onboarding@resend.dev>"
```

Notes:
- `CONTACT_TO_EMAIL` is the inbox that receives contact submissions.
- For production sending, use a verified `CONTACT_FROM_EMAIL` domain in Resend.
- Contact form requires explicit consent to Privacy Policy and Terms.
- Legal pages are available at `/privacy` and `/terms`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

- `src/app` contains the public routes, admin routes, and API routes
- `src/components` contains the gallery UI, admin dashboard, branding controls, lightbox, and forms
- `src/lib` contains data access, auth configuration, branding utilities, and service helpers

## Deployment

This project is configured for deployment on **Netlify**.

Important production services include:

- MongoDB Atlas
- Cloudinary
- Google OAuth credentials
- Resend
- Netlify environment variables
