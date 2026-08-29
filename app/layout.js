import './globals.css';

export const metadata={
  title:'InterviewDrill',
  description:'Machine-coding and LLD interview typing trainer'
};

export default function RootLayout({children}){
  return <html lang="en"><body>{children}</body></html>;
}
