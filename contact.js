// pages/contact.js
import { useState } from "react";
import Header from "../components/Header";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      // handle success
    } else {
      // handle error
    }
  };

  return (
    <div>
      <Header />
      <main>
        <h1>Contact Us</h1>
        <form onSubmit={handleSubmit}>
          <label>Name:</label>
          <input
            type="text"
            name="name"
            required
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <label>Email:</label>
          <input
            type="email"
            name="email"
            required
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
          <label>Message:</label>
          <textarea
            name="message"
            required
            onChange={(e) =>
              setFormData({ ...formData, message: e.target.value })
            }
          ></textarea>
          <button type="submit">Submit</button>
        </form>
      </main>
    </div>
  );
}
