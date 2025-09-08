import React from 'react'
import Head from 'next/head'

export default function Home() {
  return (
    <>
      <Head>
        <title>Quantum NLP Platform - Admin Dashboard</title>
        <meta name="description" content="Enterprise NLP platform admin interface" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Quantum NLP Platform - Admin Dashboard</h1>
        <p>Welcome to the Admin Dashboard</p>
        <p>Status: Frontend successfully deployed!</p>
      </div>
    </>
  )
}