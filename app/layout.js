import "./globals.css";

export const metadata = {
  title: "Amit's Salon — Look Sharp. Feel Confident.",
  description: "Amit's premium men's salon — precision cuts, classic grooming and modern style.",
};

export default function RootLayout({ children }) {
  return <html lang="hi"><body>{children}</body></html>;
}
