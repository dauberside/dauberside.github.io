// pages/index.js
import Link from 'next/link';
import Header from '../components/Header';
import Footer from '../components/Footer';

export default function Home() {
    const client_id = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
    const redirect_uri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI;
    const scope = 'user-read-private user-read-email';
    
    return (
        <>
            <Header />
            <main>
                <div>
                    <h1>Spotify Authentication</h1>
                    <Link href={`https://accounts.spotify.com/authorize?client_id=${client_id}&response_type=code&redirect_uri=${redirect_uri}&scope=${scope}`}>
                        Login with Spotify
                    </Link>
                </div>
            </main>
            <Footer />
        </>
    );
}