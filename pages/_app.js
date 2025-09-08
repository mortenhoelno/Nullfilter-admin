// pages/_app.js
import ToastHost from "../components/ToastHost";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <ToastHost />
    </>
  );
}
