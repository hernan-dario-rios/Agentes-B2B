import "./globals.css";

export const metadata = {
  title: "INNOVAIT | B2B Sales Command Center (HITL)",
  description: "Orquestador de agentes comerciales B2B con compuertas de decisión humanas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
