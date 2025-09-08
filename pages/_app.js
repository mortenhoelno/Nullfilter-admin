// pages/_app.js — FERDIG VERSJON (BYTT UT)
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

// pages/_app.js
import ToastHost from "../components/ToastHost";
import "../styles/globals.css"; // hvis du har globale styles

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <ToastHost />
    </>
  );
}
