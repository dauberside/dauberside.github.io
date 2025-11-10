// src/lib/error-messages.ts
// User-friendly error message generation system

import {
    SystemError,
    ErrorType,
    ErrorContext,
    ErrorSuggestion,
    RecoveryType
} from './errors';

/**
 * User error message with actionable guidance
 */
export interface UserErrorMessage {
    title: string;
    description: string;
    suggestions: string[];
    recoveryOptions: RecoveryOption[];
    contactSupport: boolean;
    severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Recovery option presented to user
 */
export interface RecoveryOption {
    label: string;
    description: string;
    action: string; // Action identifier for handling
    primary: boolean;
    riskLevel: 'safe' | 'caution' | 'warning';
}

/**
 * Recovery instruction for user guidance
 */
export interface RecoveryInstruction {
    step: number;
    instruction: string;
    example?: string;
    warning?: string;
}

/**
 * Context for message personalization
 */
export interface MessageContext {
    userId: string;
    userLanguage?: string;
    operationType: string;
    previousErrors?: ErrorType[];
    userExperienceLevel?: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Localized error message templates
 */
type ErrorMessageTemplate = {
    title: string;
    description: string;
    suggestions: readonly string[];
    severity: 'info' | 'warning' | 'error' | 'critical';
    contactSupport: boolean;
};

// 部分的定義（未定義の ErrorType は後でフォールバック扱い）
const ERROR_MESSAGE_TEMPLATES: Partial<Record<ErrorType, ErrorMessageTemplate>> = {
    [ErrorType.USER_INPUT_ERROR]: {
        title: '入力エラー',
        description: '入力内容に問題があります。正しい形式で入力してください。',
        suggestions: [
            '入力内容を確認してください',
            '例: 「明日 15:00-16:00 会議 @会議室A」',
            '日時、タイトル、場所の順で入力してください'
        ],
        severity: 'warning' as const,
        contactSupport: false
    },

    [ErrorType.INVALID_DATE_TIME]: {
        title: '日時の形式エラー',
        description: '指定された日時の形式が正しくありません。',
        suggestions: [
            '日時を正しい形式で入力してください',
            '例: 「12/25 14:00」「明日の午後3時」「来週火曜 10:30-11:30」',
            '過去の日時は指定できません'
        ],
        severity: 'warning' as const,
        contactSupport: false
    },

    [ErrorType.SCHEDULE_CONFLICT]: {
        title: '予定の競合',
        description: '指定された時間に既に他の予定があります。',
        suggestions: [
            '別の時間帯を選択してください',
            '既存の予定を変更または削除してください',
            '空いている時間帯を確認してください'
        ],
        severity: 'info' as const,
        contactSupport: false
    },

    [ErrorType.GOOGLE_CALENDAR_ERROR]: {
        title: 'カレンダー接続エラー',
        description: 'Google Calendarとの接続に問題が発生しました。',
        suggestions: [
            'しばらく待ってから再試行してください',
            'インターネット接続を確認してください',
            'カレンダーの権限設定を確認してください'
        ],
        severity: 'error' as const,
        contactSupport: true
    },

    [ErrorType.NETWORK_ERROR]: {
        title: 'ネットワークエラー',
        description: 'ネットワーク接続に問題があります。',
        suggestions: [
            'インターネット接続を確認してください',
            'しばらく待ってから再試行してください',
            'Wi-Fiまたはモバイルデータ接続を確認してください'
        ],
        severity: 'error' as const,
        contactSupport: false
    },

    [ErrorType.SESSION_ERROR]: {
        title: 'セッションエラー',
        description: 'セッションが無効または期限切れです。',
        suggestions: [
            '操作を最初からやり直してください',
            '「予定変更」と送信して再開してください',
            'しばらく時間をおいてから再試行してください'
        ],
        severity: 'warning' as const,
        contactSupport: false
    },

    [ErrorType.RATE_LIMIT_ERROR]: {
        title: '利用制限',
        description: '短時間に多くの操作が行われました。',
        suggestions: [
            '1分程度待ってから再試行してください',
            '頻繁な操作を控えてください',
            '必要に応じて操作をまとめて行ってください'
        ],
        severity: 'warning' as const,
        contactSupport: false
    },

    [ErrorType.CLOUDFLARE_AI_ERROR]: {
        title: 'AI処理エラー',
        description: 'AI による自然言語処理に問題が発生しました。',
        suggestions: [
            'より具体的で明確な表現で入力してください',
            '手動で詳細を指定してください',
            '例: 「明日 15:00-16:00 プロジェクト会議 @会議室A」'
        ],
        severity: 'warning' as const,
        contactSupport: false
    },

    [ErrorType.AUTHENTICATION_ERROR]: {
        title: '認証エラー',
        description: '認証に失敗しました。',
        suggestions: [
            'ログイン状態を確認してください',
            'アカウント設定を確認してください',
            '必要に応じて再ログインしてください'
        ],
        severity: 'error' as const,
        contactSupport: true
    },

    [ErrorType.SYSTEM_ERROR]: {
        title: 'システムエラー',
        description: 'システム内部でエラーが発生しました。',
        suggestions: [
            'しばらく待ってから再試行してください',
            '問題が続く場合はサポートにお問い合わせください',
            '操作内容を記録しておいてください'
        ],
        severity: 'critical' as const,
        contactSupport: true
    }
};

/**
 * Recovery action labels in Japanese
 */
const RECOVERY_ACTION_LABELS = {
    [RecoveryType.RETRY]: {
        label: '再試行',
        description: '自動的に再試行します',
        action: 'retry_operation'
    },
    [RecoveryType.ROLLBACK]: {
        label: '前の状態に戻る',
        description: '操作前の状態に戻します',
        action: 'rollback_operation'
    },
    [RecoveryType.MANUAL_FIX]: {
        label: '手動で修正',
        description: '入力内容を修正してください',
        action: 'manual_correction'
    },
    [RecoveryType.ALTERNATIVE_FLOW]: {
        label: '代替案を表示',
        description: '他の選択肢を提案します',
        action: 'show_alternatives'
    },
    [RecoveryType.SKIP]: {
        label: 'スキップ',
        description: 'この操作をスキップします',
        action: 'skip_operation'
    },
    [RecoveryType.RESTART_SESSION]: {
        label: '最初からやり直し',
        description: '新しいセッションを開始します',
        action: 'restart_session'
    }
} as const;

/**
 * Error Message Generator - creates user-friendly error messages
 */
export class ErrorMessageGenerator {
    /**
     * Generate user-friendly error message
     */
    generateUserMessage(
        error: SystemError,
        context: MessageContext
    ): UserErrorMessage {
    const template = ERROR_MESSAGE_TEMPLATES[error.type];

        if (!template) {
            return this.generateGenericErrorMessage(error, context);
        }

        // Personalize message based on context
        const personalizedDescription = this.personalizeDescription(
            template.description,
            error,
            context
        );

        const personalizedSuggestions = this.personalizeSuggestions(
            [...template.suggestions],
            error,
            context
        );

        const recoveryOptions = this.generateRecoveryOptions(error.suggestions, context);

        return {
            title: template.title,
            description: personalizedDescription,
            // suggestions は変更可能な配列が期待されるためコピーして mutable にする
            suggestions: [...personalizedSuggestions],
            recoveryOptions,
            contactSupport: template.contactSupport,
            severity: template.severity
        };
    }

    /**
     * Generate suggestions based on error and context
     */
    generateSuggestions(error: SystemError, context: MessageContext): string[] {
        const base = ERROR_MESSAGE_TEMPLATES[error.type]?.suggestions || [];
        const baseSuggestions = [...base];

        // Add context-specific suggestions
        const contextualSuggestions = this.getContextualSuggestions(error, context);

        // Add experience-level appropriate suggestions
        const levelSuggestions = this.getExperienceLevelSuggestions(error, context);

        return [...baseSuggestions, ...contextualSuggestions, ...levelSuggestions]
            .slice(0, 5); // Limit to 5 suggestions
    }

    /**
     * Generate recovery instructions
     */
    generateRecoveryInstructions(error: SystemError, context: MessageContext): RecoveryInstruction[] {
        const instructions: RecoveryInstruction[] = [];

        switch (error.type) {
            case ErrorType.INVALID_DATE_TIME:
                instructions.push(
                    {
                        step: 1,
                        instruction: '正しい日時形式で入力してください',
                        example: '例: 「12/25 14:00-15:00」または「明日の午後2時から1時間」'
                    },
                    {
                        step: 2,
                        instruction: '日付と時間の両方を含めてください',
                        warning: '過去の日時は指定できません'
                    }
                );
                break;

            case ErrorType.SCHEDULE_CONFLICT:
                instructions.push(
                    {
                        step: 1,
                        instruction: '「予定確認」と送信して空いている時間を確認してください'
                    },
                    {
                        step: 2,
                        instruction: '別の時間帯を選択するか、既存の予定を変更してください'
                    }
                );
                break;

            case ErrorType.NETWORK_ERROR:
                instructions.push(
                    {
                        step: 1,
                        instruction: 'インターネット接続を確認してください'
                    },
                    {
                        step: 2,
                        instruction: '30秒程度待ってから再試行してください'
                    },
                    {
                        step: 3,
                        instruction: '問題が続く場合は、Wi-Fi接続を確認するか、モバイルデータに切り替えてください'
                    }
                );
                break;

            case ErrorType.SESSION_ERROR:
                instructions.push(
                    {
                        step: 1,
                        instruction: '「予定変更」と送信して新しいセッションを開始してください'
                    },
                    {
                        step: 2,
                        instruction: '操作を最初からやり直してください'
                    }
                );
                break;

            default:
                instructions.push({
                    step: 1,
                    instruction: 'しばらく待ってから操作を再試行してください'
                });
        }

        return instructions;
    }

    /**
     * Personalize error description based on context
     */
    private personalizeDescription(
        baseDescription: string,
        error: SystemError,
        context: MessageContext
    ): string {
        let description = baseDescription;

        // Add operation-specific context
        if (context.operationType === 'schedule_edit') {
            description += ' 予定の編集中にエラーが発生しました。';
        } else if (context.operationType === 'schedule_create') {
            description += ' 予定の作成中にエラーが発生しました。';
        }

        // Add frequency context for repeated errors
        if (context.previousErrors?.includes(error.type)) {
            description += ' この問題が繰り返し発生している場合は、入力方法を見直してください。';
        }

        return description;
    }

    /**
     * Personalize suggestions based on user context
     */
    private personalizeSuggestions(
        baseSuggestions: string[],
        error: SystemError,
        context: MessageContext
    ): string[] {
        const suggestions = [...baseSuggestions];

        // Add beginner-friendly suggestions
        if (context.userExperienceLevel === 'beginner') {
            switch (error.type) {
                case ErrorType.INVALID_DATE_TIME:
                    suggestions.unshift('初めての方へ: 「明日 午後2時から1時間 会議」のように自然な言葉で入力できます');
                    break;
                case ErrorType.USER_INPUT_ERROR:
                    suggestions.unshift('ヘルプ: 「使い方」と送信すると詳しい説明を確認できます');
                    break;
            }
        }

        return suggestions;
    }

    /**
     * Generate recovery options from error suggestions
     */
    private generateRecoveryOptions(
        errorSuggestions: ErrorSuggestion[],
        context: MessageContext
    ): RecoveryOption[] {
        return errorSuggestions.map((suggestion, index) => {
            const actionLabel = RECOVERY_ACTION_LABELS[suggestion.type];

            return {
                label: actionLabel?.label || suggestion.title,
                description: actionLabel?.description || suggestion.userFriendlyDescription,
                action: actionLabel?.action || `recovery_${suggestion.type}`,
                primary: index === 0 && suggestion.automated,
                riskLevel: this.mapRiskLevel(suggestion.riskLevel)
            };
        });
    }

    /**
     * Get contextual suggestions based on operation type
     */
    private getContextualSuggestions(
        error: SystemError,
        context: MessageContext
    ): string[] {
        const suggestions: string[] = [];

        if (context.operationType === 'schedule_edit' && error.type === ErrorType.SCHEDULE_CONFLICT) {
            suggestions.push('編集中の予定: 時間を少しずらすか、別の日に変更してください');
        }

        if (context.previousErrors?.length && context.previousErrors.length > 2) {
            suggestions.push('頻繁なエラー: 「ヘルプ」と送信して使い方を確認してください');
        }

        return suggestions;
    }

    /**
     * Get experience-level appropriate suggestions
     */
    private getExperienceLevelSuggestions(
        error: SystemError,
        context: MessageContext
    ): string[] {
        const suggestions: string[] = [];

        if (context.userExperienceLevel === 'advanced') {
            switch (error.type) {
                case ErrorType.GOOGLE_CALENDAR_ERROR:
                    suggestions.push('上級者向け: API制限やOAuth認証の問題の可能性があります');
                    break;
                case ErrorType.SYSTEM_ERROR:
                    suggestions.push('詳細: エラーID ' + error.errorId + ' をサポートに報告してください');
                    break;
            }
        }

        return suggestions;
    }

    /**
     * Generate generic error message for unknown error types
     */
    private generateGenericErrorMessage(
        error: SystemError,
        context: MessageContext
    ): UserErrorMessage {
        return {
            title: 'エラーが発生しました',
            description: error.userMessage || error.message || '予期しないエラーが発生しました。',
            suggestions: [
                'しばらく待ってから再試行してください',
                '問題が続く場合はサポートにお問い合わせください',
                'エラーID: ' + error.errorId
            ],
            recoveryOptions: [],
            contactSupport: true,
            severity: 'error'
        };
    }

    /**
     * Map risk level to user-friendly representation
     */
    private mapRiskLevel(riskLevel: any): 'safe' | 'caution' | 'warning' {
        switch (riskLevel) {
            case 'SAFE':
            case 'LOW_RISK':
                return 'safe';
            case 'MEDIUM_RISK':
                return 'caution';
            case 'HIGH_RISK':
                return 'warning';
            default:
                return 'safe';
        }
    }
}

/**
 * Format error message for LINE Bot display
 */
export function formatErrorMessageForLine(
    userMessage: UserErrorMessage,
    includeRecoveryOptions: boolean = true
): string {
    let message = `❌ ${userMessage.title}\n\n${userMessage.description}`;

    if (userMessage.suggestions.length > 0) {
        message += '\n\n💡 解決方法:';
        userMessage.suggestions.slice(0, 3).forEach((suggestion, index) => {
            message += `\n${index + 1}. ${suggestion}`;
        });
    }

    if (includeRecoveryOptions && userMessage.recoveryOptions.length > 0) {
        const primaryOption = userMessage.recoveryOptions.find(o => o.primary);
        if (primaryOption) {
            message += `\n\n🔧 ${primaryOption.label}: ${primaryOption.description}`;
        }
    }

    if (userMessage.contactSupport) {
        message += '\n\n📞 問題が解決しない場合は、サポートまでお問い合わせください。';
    }

    return message;
}

/**
 * Create contextual error message with user information
 */
export function createContextualErrorMessage(
    error: SystemError,
    userId: string,
    operationType: string,
    userExperienceLevel?: 'beginner' | 'intermediate' | 'advanced'
): UserErrorMessage {
    const generator = new ErrorMessageGenerator();
    const context: MessageContext = {
        userId,
        operationType,
        userExperienceLevel: userExperienceLevel || 'intermediate'
    };

    return generator.generateUserMessage(error, context);
}

// Export singleton instance
export const errorMessageGenerator = new ErrorMessageGenerator();