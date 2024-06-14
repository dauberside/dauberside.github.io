// components/LoginModal.js
import React, { useState } from 'react';
import { Modal, Button, Form } from 'react-bootstrap';
import { useRouter } from 'next/router';

const LoginModal = ({ show, handleClose, handleLogin, handleSignup }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false); // サインアップモードのフラグ
  const router = useRouter();

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isSignup) {
        await handleSignup(email, password);
        alert('アカウントが作成されました！チャットページに移動します。');
        router.push('/chat');  // サインアップ後にチャットページにリダイレクト
      } else {
        await handleLogin(email, password);
        alert('ログインに成功しました！チャットページに移動します。');
        router.push('/chat');  // ログイン後にチャットページにリダイレクト
      }
      handleClose();
    } catch (error) {
      alert('処理に失敗しました。再度お試しください。');
    }
  };

  return (
    <Modal show={show} onHide={handleClose} animation={false}>
      <Modal.Header closeButton>
        <Modal.Title>{isSignup ? 'Sign Up' : 'Login'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form onSubmit={onSubmit}>
          <Form.Group controlId="formEmail">
            <Form.Label>Email address</Form.Label>
            <Form.Control
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Form.Group>
          <Form.Group controlId="formPassword">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Form.Group>
          <Button variant="primary" type="submit">
            {isSignup ? 'Sign Up' : 'Login'}
          </Button>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => setIsSignup(!isSignup)}>
          {isSignup ? 'Already have an account? Login' : 'Create an account'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default LoginModal;
