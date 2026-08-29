import './globals.css';

export const metadata = {
  title: 'कृषि सेतु | FarmerSetu',
  description: 'Smart Bridge Between Farmers & Markets',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
