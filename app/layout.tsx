import './globals.css';
import OperationsBackdrop from './operations-backdrop';
export const metadata = { title: 'Magic 8 BOL', description: 'Location inbound planning and purchase order visibility', icons: { icon: '/favicon.svg' } };
export default function Layout({children}: {children: React.ReactNode}) { return <html lang="en"><body><OperationsBackdrop/>{children}</body></html>; }
