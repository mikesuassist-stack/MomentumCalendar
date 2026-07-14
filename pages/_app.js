import Head from 'next/head'

// Global wrapper: guarantees correct mobile scaling on every page
// and sets the browser tab title.
export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>GSMR Content Calendar</title>
      </Head>
      <Component {...pageProps} />
    </>
  )
}
