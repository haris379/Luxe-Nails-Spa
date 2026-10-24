// Sample business details — replace with the salon's real information.
const env = import.meta.env;

export const site = {
  name: "Luxe Nails",
  tagline: "Premium nail care and artistry for the modern woman.",
  addressLines: ["Rosario, Cavite", "Philippines"],
  phone: "(046) 123-4567",
  phoneHref: "tel:+63461234567",
  email: "info.luxenails.booking@gmail.com",
  whatsappNumber: env.VITE_WHATSAPP_NUMBER || "639170000000",
  mapsUrl:
    env.VITE_MAPS_URL ||
    "https://www.google.com/maps/search/?api=1&query=Rosario%2C+Cavite%2C+Philippines",
  mapsEmbed:
    "https://www.google.com/maps?q=Rosario,+Cavite,+Philippines&output=embed",
  social: {
    facebook: env.VITE_FACEBOOK_URL || "https://www.facebook.com/",
    instagram: env.VITE_INSTAGRAM_URL || "https://www.instagram.com/",
    twitter: env.VITE_TWITTER_URL || "https://twitter.com/",
  },
  hours: [
    ["Monday - Friday", "9:00 AM - 8:00 PM"],
    ["Saturday", "10:00 AM - 7:00 PM"],
    ["Sunday", "11:00 AM - 6:00 PM"],
  ],
};

export const whatsappLink = (
  text = "Hi Luxe Nails, I would like to ask about an appointment.",
) => `https://wa.me/${site.whatsappNumber}?text=${encodeURIComponent(text)}`;

export const navLinks = [
  { to: "/", label: "Home", end: true },
  { to: "/services", label: "Services" },
  { to: "/gallery", label: "Gallery" },
  { to: "/booking", label: "Booking" },
  { to: "/about", label: "About Us" },
  { to: "/contact", label: "Contact" },
];

export const faqs = [
  {
    q: "How do I book an appointment?",
    a: "Open the Booking page, choose a service, pick a date and an available time, and enter your contact details. You will see a reference number once the salon has received your request.",
  },
  {
    q: "How long does a manicure take?",
    a: "A classic manicure takes about 45 minutes and a gel polish manicure about 60 minutes. Nail art and extensions take longer; each service lists its estimated duration.",
  },
  {
    q: "What is the difference between gel and acrylic nails?",
    a: "Gel is flexible, lightweight and cures under a lamp. Acrylic is a harder, very durable product that is mixed and sculpted on the nail. Our technicians can recommend one based on your lifestyle.",
  },
  {
    q: "Can I cancel or reschedule an appointment?",
    a: "Yes. Please let us know at least 24 hours in advance by phone, WhatsApp or email so we can offer your time to another guest.",
  },
  {
    q: "What should I do if I am running late?",
    a: "Please arrive 10 minutes early. If you are running late, message us on WhatsApp right away; we will try to keep your slot but may need to shorten or reschedule the service.",
  },
  {
    q: "Which payment methods are accepted?",
    a: "We accept cash, credit cards and digital payments at the salon. No payment is taken on this website.",
  },
];
