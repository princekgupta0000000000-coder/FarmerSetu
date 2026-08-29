import './globals.css';
import BookingSuccessSound from '../components/BookingSuccessSound';

export const metadata = {
  title: 'कृषि सेतु | FarmerSetu',
  description: 'Smart Bridge Between Farmers & Markets',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <BookingSuccessSound />
        {children}
      </body>
    </html>
  );
}
