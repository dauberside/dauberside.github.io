import type { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: "/", // リダイレクト先のページ
      permanent: false, // 一時的なリダイレクト
    },
  };
};

const Chat = () => {
  return (
    <div style={{ textAlign: "center", marginTop: "50px" }}>
      <h1>現在、チャット機能は閉鎖中です。</h1>
      <p>後ほど再開予定です。ご理解いただきありがとうございます。</p>
    </div>
  );
};

export default Chat;
