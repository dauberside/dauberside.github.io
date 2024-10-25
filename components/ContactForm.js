import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const ContactForm = ({ isOpen, onRequestClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const firstInput = document.getElementById("name");
      if (firstInput) {
        firstInput.focus();
      }
    }
  }, [isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "email" && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) {
      setErrorMessage("Invalid email address");
    } else {
      setErrorMessage('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const errorText = await response.text();
        setErrorMessage(errorText);
        console.error('Failed to send message:', errorText);
      }
    } catch (error) {
      setErrorMessage(error.message);
      console.error('Error occurred:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onRequestClose} aria-labelledby="contactFormTitle">
      <DialogContent className="text-white">
        <DialogHeader>
          <DialogTitle id="contactFormTitle">Contact Us</DialogTitle>
          <DialogDescription>
            {!submitted ? "Fill out the form below to get in touch." : "Thank you for your message!"}
          </DialogDescription>
        </DialogHeader>
        {!submitted ? (
          <form id="contact-form" role="form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="Your Name"
                required
                value={formData.name}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Your Email"
                required
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                name="message"
                placeholder="Your Message"
                required
                maxLength="140"
                value={formData.message}
                onChange={handleInputChange}
              />
            </div>
            {errorMessage && <p className="text-red-500">{errorMessage}</p>}
            <DialogFooter>
              <Button type="button" onClick={onRequestClose} variant="ghost">Close</Button>
              <Button type="submit" variant="ghost" disabled={!formData.name || !formData.email || !formData.message || errorMessage}>
                Submit
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div id="success-message">
            <h5 className="text-lg font-bold">送信完了しました。ありがとうございました！</h5>
            <p><strong>Name:</strong> {formData.name}</p>
            <p><strong>Email:</strong> {formData.email}</p>
            <p><strong>Message:</strong> {formData.message}</p>
            <Button onClick={() => setSubmitted(false)} variant="ghost">
              Another message
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactForm;