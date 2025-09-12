import React, { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ContactForm = ({ isOpen, onRequestClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm();
  const [serverError, setServerError] = useState("");

  // 入力監視（残り文字数表示用）
  const messageValue = watch("message") || "";
  const remaining = 140 - (messageValue?.length || 0);

  // フォームのリセットは先に定義して、以降のhooksで安全に参照できるようにする
  const handleReset = useCallback(() => {
    setSubmitted(false);
    setServerError("");
    reset();
  }, [reset]);

  // ダイアログを開いたら最初の入力へフォーカス、閉じたらフォームをリセット
  useEffect(() => {
    if (isOpen && !submitted) {
      // Dialogのアニメーション直後にフォーカスさせる
      const t = setTimeout(() => {
        const firstInput = document.getElementById("name");
        if (firstInput) firstInput.focus();
      }, 20);
      return () => clearTimeout(t);
    }
    if (!isOpen) {
      handleReset();
    }
  }, [isOpen, submitted, handleReset]);

  const onSubmit = async (data) => {
    setServerError("");
    // ハニーポット対応: bot っぽい送信は静かに成功扱い
    if (data.website) {
      setSubmitted(true);
      return;
    }
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
        const errorJson = await response.json().catch(() => null);
        const errorMessage = errorJson?.error || (await response.text());
        setServerError(errorMessage);
        console.error("メッセージの送信に失敗しました:", errorMessage);
      }
    } catch (error) {
      setServerError(error?.message || "送信中にエラーが発生しました");
      console.error("エラーが発生しました:", error);
    }
  };

  

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onRequestClose}
      aria-labelledby="contactFormTitle"
    >
      <DialogContent className="bg-background">
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
            aria-busy={isSubmitting ? "true" : "false"}
            noValidate
          >
            {/* ハニーポット（bot対策 / ユーザーには非表示） */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                {...register("website")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">お名前</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                {...register("name", { required: "お名前は必須です" })}
                placeholder="山田 太郎"
                aria-invalid={errors.name ? "true" : "false"}
                aria-describedby={errors.name ? "name-error" : undefined}
              />
              {errors.name && (
                <p
                  id="name-error"
                  className="text-destructive text-sm"
                  aria-live="polite"
                >
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                {...register("email", {
                  required: "メールアドレスは必須です",
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "有効なメールアドレスを入力してください",
                  },
                })}
                placeholder="example@example.com"
                aria-invalid={errors.email ? "true" : "false"}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p
                  id="email-error"
                  className="text-destructive text-sm"
                  aria-live="polite"
                >
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">メッセージ</Label>
              <Textarea
                id="message"
                autoComplete="off"
                {...register("message", {
                  required: "メッセージは必須です",
                  maxLength: {
                    value: 140,
                    message: "メッセージは140文字以内で入力してください",
                  },
                })}
                placeholder="ご用件をお書きください"
                aria-invalid={errors.message ? "true" : "false"}
                aria-describedby={
                  errors.message ? "message-error" : "message-help"
                }
              />
              <div id="message-help" className="text-xs text-muted-foreground">
                残り {remaining} 文字（最大 140 文字）
              </div>
              {errors.message && (
                <p
                  id="message-error"
                  className="text-destructive text-sm"
                  aria-live="polite"
                >
                  {errors.message.message}
                </p>
              )}
            </div>
            {serverError && (
              <p
                className="text-destructive"
                role="alert"
                aria-live="assertive"
              >
                {serverError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                onClick={onRequestClose}
                variant="ghost"
                disabled={isSubmitting}
              >
                close
              </Button>
              <Button type="submit" variant="ghost" disabled={isSubmitting}>
                {isSubmitting ? "sending..." : "send"}
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
