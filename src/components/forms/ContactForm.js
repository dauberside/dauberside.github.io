import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";

const ContactForm = ({ isOpen, onRequestClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const firstInput = document.getElementById("name");
      if (firstInput) {
        firstInput.focus();
      }
    }
  }, [isOpen]);

  const onSubmit = async (data) => {
    try {
      const response = await fetch("/api/send", {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        const errorText = await response.text();
        setServerError(errorText);
        console.error("メッセージの送信に失敗しました:", errorText);
      }
    } catch (error) {
      setServerError(error.message);
      console.error("エラーが発生しました:", error);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setServerError("");
    reset();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onRequestClose}
      aria-labelledby="contactFormTitle"
    >
      <DialogContent className="bg-background ">
        <DialogHeader>
          <DialogTitle id="contactFormTitle">お問い合わせ</DialogTitle>
          <DialogDescription>
            {!submitted
              ? "以下のフォームにご記入ください。"
              : "メッセージをお送りいただき、ありがとうございます！"}
          </DialogDescription>
        </DialogHeader>
        {!submitted ? (
          <form
            id="contact-form"
            role="form"
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">お名前</Label>
              <Input
                id="name"
                {...register("name", { required: "お名前は必須です" })}
                placeholder="山田 太郎"
                aria-invalid={errors.name ? "true" : "false"}
              />
              {errors.name && (
                <p className="text-destructive text-sm">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                {...register("email", {
                  required: "メールアドレスは必須です",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "有効なメールアドレスを入力してください",
                  },
                })}
                placeholder="example@example.com"
                aria-invalid={errors.email ? "true" : "false"}
              />
              {errors.email && (
                <p className="text-destructive text-sm">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">メッセージ</Label>
              <Textarea
                id="message"
                {...register("message", {
                  required: "メッセージは必須です",
                  maxLength: {
                    value: 140,
                    message: "メッセージは140文字以内で入力してください",
                  },
                })}
                placeholder="ご用件をお書きください"
                aria-invalid={errors.message ? "true" : "false"}
              />
              {errors.message && (
                <p className="text-destructive text-sm">
                  {errors.message.message}
                </p>
              )}
            </div>
            {serverError && <p className="text-destructive">{serverError}</p>}
            <DialogFooter>
              <Button type="button" onClick={onRequestClose} variant="ghost">
                close
              </Button>
              <Button type="submit" variant="ghost">
                send
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div id="success-message" className="space-y-4">
            <h5 className="text-lg font-bold">
              送信完了しました。ありがとうございました！
            </h5>
            <Button onClick={handleReset} variant="outline">
              別のメッセージを送信
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContactForm;
