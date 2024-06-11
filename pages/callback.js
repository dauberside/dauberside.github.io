// pages/callback.js
import { useRouter } from 'next/router';
import React from 'react';

const Callback = () => {
    const router = useRouter();
    const { code } = router.query;

    useEffect(() => {
        if (code) {
            const fetchToken = async () => {
                try {
                    const response = await fetch('/api/getToken', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ code }),
                    });

                    const data = await response.json();
                    localStorage.setItem('spotifyToken', data.access_token);
                    router.push('/profile');
                } catch (error) {
                    console.error('Error fetching token:', error);
                }
            };

            fetchToken();
        }
    }, [code, router]);

    return <h1>認証が完了しました。トークンを取得しています...</h1>;
};

export default Callback;