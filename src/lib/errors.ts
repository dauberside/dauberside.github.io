// src/lib/errors.ts
// Comprehensive error classification and handling system

/**
 * Comprehensive error type classification for the schedule management system
 */
export enum ErrorType {
  // User input related errors
  USER_INPUT_ERROR = "user_input_error",
  INVALID_DATE_TIME = "invalid_date_time",
  INVALID_DURATION = "invalid_duration",
  MISSING_REQUIRED_FIELD = "missing_required_field",

  // System and internal errors
  SYSTEM_ERROR = "system_error",
  SESSION_ERROR = "session_error",
  DATA_CORRUPTION = "data_corruption",
  CONFIGURATION_ERROR = "configuration_error",

  // External API errors
  EXTERNAL_API_ERROR = "external_api_error",
  GOOGLE_CALENDAR_ERROR = "google_calendar_error",
  CLOUDFLARE_AI_ERROR = "cloudflare_ai_error",
  WEATHER_API_ERROR = "weather_api_error",
  TRAFFIC_API_ERROR = "traffic_api_error",

  // Network and connectivity errors
  NETWORK_ERROR = "network_error",
  TIMEOUT_ERROR = "timeout_error",
  CONNECTION_ERROR = "connection_error",

  // Authentication and authorization errors
  AUTHENTICATION_ERROR = "auth_error",
  AUTHORIZATION_ERROR = "authorization_error",
  TOKEN_EXPIRED = "token_expired",
  INVALID_CREDENTIALS = "invalid_credentials",

  // Rate limiting and quota errors
  RATE_LIMIT_ERROR = "rate_limit_error",
  QUOTA_EXCEEDED = "quota_exceeded",

  // Data validation errors
  DATA_VALIDATION_ERROR = "validation_error",
  SCHEMA_VALIDATION_ERROR = "schema_validation_error",
  BUSINESS_RULE_VIOLATION = "business_rule_violation",

  // Conflict and constraint errors
  SCHEDULE_CONFLICT = "schedule_conflict",
  RESOURCE_CONFLICT = "resource_conflict",
  CONSTRAINT_VIOLATION = "constraint_violation",
}

/**
 * Error severity levels for prioritization and handling
 */
export enum ErrorSeverity {
  LOW = "low", // Minor issues, system can continue
  MEDIUM = "medium", // Moderate issues, some functionality affected
  HIGH = "high", // Serious issues, major functionality affected
  CRITICAL = "critical", // Critical issues, system functionality severely impacted
}

/**
 * Recovery action types for error resolution
 */
export enum RecoveryType {
  RETRY = "retry",
  ROLLBACK = "rollback",
  MANUAL_FIX = "manual_fix",
  ALTERNATIVE_FLOW = "alternative_flow",
  SKIP = "skip",
  RESTART_SESSION = "restart_session",
}

/**
 * Risk levels for recovery actions
 */
export enum RiskLevel {
  SAFE = "safe",
  LOW_RISK = "low_risk",
  MEDIUM_RISK = "medium_risk",
  HIGH_RISK = "high_risk",
}

/**
 * Context information preserved when an error occurs
 */
export interface ErrorContext {
  userId?: string;
  groupId?: string;
  sessionId?: string;
  operationType: string;
  operationStep: string;
  timestamp: number;
  userInput?: string;
  systemState?: any;
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

/**
 * Suggestion for error recovery
 */
export interface ErrorSuggestion {
  type: RecoveryType;
  title: string;
  description: string;
  userFriendlyDescription: string;
  automated: boolean;
  riskLevel: RiskLevel;
  estimatedSuccessRate: number;
  actionData?: any;
}

/**
 * Comprehensive system error with user-friendly messaging
 */
export interface SystemError {
  // Core error information
  type: ErrorType;
  code: string;
  message: string;
  userMessage: string;
  severity: ErrorSeverity;

  // Recovery and suggestions
  suggestions: ErrorSuggestion[];
  recoverable: boolean;
  retryable: boolean;

  // Context and debugging
  context: ErrorContext;
  originalError?: Error;

  // Metadata
  timestamp: number;
  errorId: string;
}

/**
 * Error message templates for consistent user communication
 */
export const ERROR_MESSAGES: Record<
  ErrorType,
  {
    title: string;
    template: string;
    suggestions: string[];
  }
> = {
  [ErrorType.USER_INPUT_ERROR]: {
    title: "入力エラー",
    template: "入力内容に問題があります: {details}",
    suggestions: [
      "入力内容を確認してください",
      "例: 「明日 15:00-16:00 会議」",
    ],
  },

  [ErrorType.INVALID_DATE_TIME]: {
    title: "日時エラー",
    template: "指定された日時が無効です: {details}",
    suggestions: [
      "正しい日時形式で入力してください",
      "例: 「12/25 14:00」「明日の午後3時」",
    ],
  },

  [ErrorType.INVALID_DURATION]: {
    title: "期間エラー",
    template: "指定された期間が無効です: {details}",
    suggestions: [
      "正しい期間を指定してください",
      "例: 「1時間」「30分」「14:00-15:00」",
    ],
  },

  [ErrorType.MISSING_REQUIRED_FIELD]: {
    title: "必須項目エラー",
    template: "必要な情報が不足しています: {details}",
    suggestions: [
      "必要な項目を全て入力してください",
      "タイトルと時間は必須です",
    ],
  },

  [ErrorType.SYSTEM_ERROR]: {
    title: "システムエラー",
    template: "システム内部でエラーが発生しました: {details}",
    suggestions: [
      "しばらく待ってから再試行してください",
      "サポートにお問い合わせください",
    ],
  },

  [ErrorType.SESSION_ERROR]: {
    title: "セッションエラー",
    template: "セッションが無効または期限切れです",
    suggestions: [
      "操作を最初からやり直してください",
      "「予定変更」と送信して再開してください",
    ],
  },

  [ErrorType.DATA_CORRUPTION]: {
    title: "データ破損エラー",
    template: "データに問題があります: {details}",
    suggestions: ["操作をやり直してください", "サポートにお問い合わせください"],
  },

  [ErrorType.CONFIGURATION_ERROR]: {
    title: "設定エラー",
    template: "システム設定に問題があります: {details}",
    suggestions: [
      "管理者にお問い合わせください",
      "しばらく待ってから再試行してください",
    ],
  },

  [ErrorType.EXTERNAL_API_ERROR]: {
    title: "外部API エラー",
    template: "外部サービスとの連携でエラーが発生しました: {details}",
    suggestions: [
      "しばらく待ってから再試行してください",
      "サービス状況を確認してください",
    ],
  },

  [ErrorType.GOOGLE_CALENDAR_ERROR]: {
    title: "カレンダー接続エラー",
    template: "Google Calendarとの接続に問題があります: {details}",
    suggestions: [
      "しばらく待ってから再試行してください",
      "カレンダーの権限を確認してください",
    ],
  },

  [ErrorType.CLOUDFLARE_AI_ERROR]: {
    title: "AI処理エラー",
    template: "AI処理に問題が発生しました",
    suggestions: [
      "より具体的に入力してください",
      "手動で詳細を指定してください",
    ],
  },

  [ErrorType.WEATHER_API_ERROR]: {
    title: "天気情報エラー",
    template: "天気情報の取得に失敗しました: {details}",
    suggestions: [
      "天気情報なしで続行します",
      "しばらく待ってから再試行してください",
    ],
  },

  [ErrorType.TRAFFIC_API_ERROR]: {
    title: "交通情報エラー",
    template: "交通情報の取得に失敗しました: {details}",
    suggestions: [
      "交通情報なしで続行します",
      "しばらく待ってから再試行してください",
    ],
  },

  [ErrorType.NETWORK_ERROR]: {
    title: "ネットワークエラー",
    template: "ネットワーク接続に問題があります",
    suggestions: [
      "インターネット接続を確認してください",
      "しばらく待ってから再試行してください",
    ],
  },

  [ErrorType.TIMEOUT_ERROR]: {
    title: "タイムアウトエラー",
    template: "処理がタイムアウトしました: {details}",
    suggestions: [
      "しばらく待ってから再試行してください",
      "ネットワーク接続を確認してください",
    ],
  },

  [ErrorType.CONNECTION_ERROR]: {
    title: "接続エラー",
    template: "サーバーへの接続に失敗しました: {details}",
    suggestions: [
      "インターネット接続を確認してください",
      "しばらく待ってから再試行してください",
    ],
  },

  [ErrorType.AUTHENTICATION_ERROR]: {
    title: "認証エラー",
    template: "認証に失敗しました: {details}",
    suggestions: ["ログイン状態を確認してください", "再ログインしてください"],
  },

  [ErrorType.AUTHORIZATION_ERROR]: {
    title: "権限エラー",
    template: "この操作を実行する権限がありません: {details}",
    suggestions: [
      "管理者にお問い合わせください",
      "必要な権限を確認してください",
    ],
  },

  [ErrorType.TOKEN_EXPIRED]: {
    title: "トークン期限切れ",
    template: "アクセストークンの期限が切れました: {details}",
    suggestions: [
      "再ログインしてください",
      "しばらく待ってから再試行してください",
    ],
  },

  [ErrorType.INVALID_CREDENTIALS]: {
    title: "認証情報エラー",
    template: "認証情報が無効です: {details}",
    suggestions: [
      "ログイン情報を確認してください",
      "管理者にお問い合わせください",
    ],
  },

  [ErrorType.RATE_LIMIT_ERROR]: {
    title: "利用制限",
    template: "しばらく時間をおいてから再試行してください",
    suggestions: ["1分後に再試行してください", "頻繁な操作を控えてください"],
  },

  [ErrorType.QUOTA_EXCEEDED]: {
    title: "利用上限エラー",
    template: "利用上限に達しました: {details}",
    suggestions: [
      "しばらく時間をおいてください",
      "管理者にお問い合わせください",
    ],
  },

  [ErrorType.DATA_VALIDATION_ERROR]: {
    title: "データ検証エラー",
    template: "データの形式が正しくありません: {details}",
    suggestions: ["入力内容を確認してください", "正しい形式で入力してください"],
  },

  [ErrorType.SCHEMA_VALIDATION_ERROR]: {
    title: "スキーマ検証エラー",
    template: "データ構造に問題があります: {details}",
    suggestions: [
      "入力形式を確認してください",
      "サポートにお問い合わせください",
    ],
  },

  [ErrorType.BUSINESS_RULE_VIOLATION]: {
    title: "ビジネスルール違反",
    template: "ビジネスルールに違反しています: {details}",
    suggestions: ["入力内容を見直してください", "ルールを確認してください"],
  },

  [ErrorType.SCHEDULE_CONFLICT]: {
    title: "予定の競合",
    template: "指定された時間に他の予定があります: {conflictDetails}",
    suggestions: ["別の時間を選択してください", "既存の予定を変更してください"],
  },

  [ErrorType.RESOURCE_CONFLICT]: {
    title: "リソース競合",
    template: "リソースが他で使用されています: {details}",
    suggestions: [
      "別のリソースを選択してください",
      "しばらく待ってから再試行してください",
    ],
  },

  [ErrorType.CONSTRAINT_VIOLATION]: {
    title: "制約違反",
    template: "システム制約に違反しています: {details}",
    suggestions: ["入力内容を確認してください", "制約条件を確認してください"],
  },
};

/**
 * Default recovery suggestions for each error type
 */
export const DEFAULT_RECOVERY_SUGGESTIONS: Record<
  ErrorType,
  ErrorSuggestion[]
> = {
  [ErrorType.USER_INPUT_ERROR]: [
    {
      type: RecoveryType.MANUAL_FIX,
      title: "入力を修正",
      description: "ユーザーに正しい入力形式を案内",
      userFriendlyDescription:
        "入力内容を確認して、正しい形式で再入力してください",
      automated: false,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.9,
    },
  ],

  [ErrorType.NETWORK_ERROR]: [
    {
      type: RecoveryType.RETRY,
      title: "自動再試行",
      description: "指数バックオフで自動再試行",
      userFriendlyDescription: "自動的に再試行します",
      automated: true,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.7,
    },
    {
      type: RecoveryType.MANUAL_FIX,
      title: "手動再試行",
      description: "ユーザーによる手動再試行",
      userFriendlyDescription: "しばらく待ってから再試行してください",
      automated: false,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.8,
    },
  ],

  [ErrorType.SESSION_ERROR]: [
    {
      type: RecoveryType.RESTART_SESSION,
      title: "セッション再開",
      description: "新しいセッションを開始",
      userFriendlyDescription: "操作を最初からやり直します",
      automated: true,
      riskLevel: RiskLevel.LOW_RISK,
      estimatedSuccessRate: 0.95,
    },
  ],

  [ErrorType.SCHEDULE_CONFLICT]: [
    {
      type: RecoveryType.ALTERNATIVE_FLOW,
      title: "代替時間提案",
      description: "競合しない時間帯を提案",
      userFriendlyDescription: "空いている時間帯を提案します",
      automated: true,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.8,
    },
  ],

  [ErrorType.GOOGLE_CALENDAR_ERROR]: [
    {
      type: RecoveryType.RETRY,
      title: "API再試行",
      description: "Google Calendar APIへの再接続を試行",
      userFriendlyDescription: "自動的に再接続を試行します",
      automated: true,
      riskLevel: RiskLevel.SAFE,
      estimatedSuccessRate: 0.6,
    },
  ],

  // 他のエラータイプのデフォルト設定...
  [ErrorType.INVALID_DATE_TIME]: [],
  [ErrorType.INVALID_DURATION]: [],
  [ErrorType.MISSING_REQUIRED_FIELD]: [],
  [ErrorType.SYSTEM_ERROR]: [],
  [ErrorType.DATA_CORRUPTION]: [],
  [ErrorType.CONFIGURATION_ERROR]: [],
  [ErrorType.EXTERNAL_API_ERROR]: [],
  [ErrorType.CLOUDFLARE_AI_ERROR]: [],
  [ErrorType.WEATHER_API_ERROR]: [],
  [ErrorType.TRAFFIC_API_ERROR]: [],
  [ErrorType.TIMEOUT_ERROR]: [],
  [ErrorType.CONNECTION_ERROR]: [],
  [ErrorType.AUTHENTICATION_ERROR]: [],
  [ErrorType.AUTHORIZATION_ERROR]: [],
  [ErrorType.TOKEN_EXPIRED]: [],
  [ErrorType.INVALID_CREDENTIALS]: [],
  [ErrorType.RATE_LIMIT_ERROR]: [],
  [ErrorType.QUOTA_EXCEEDED]: [],
  [ErrorType.DATA_VALIDATION_ERROR]: [],
  [ErrorType.SCHEMA_VALIDATION_ERROR]: [],
  [ErrorType.BUSINESS_RULE_VIOLATION]: [],
  [ErrorType.RESOURCE_CONFLICT]: [],
  [ErrorType.CONSTRAINT_VIOLATION]: [],
};

/**
 * Utility function to generate unique error IDs
 */
export function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Utility function to determine error severity based on type
 */
export function getErrorSeverity(errorType: ErrorType): ErrorSeverity {
  const severityMap: Record<ErrorType, ErrorSeverity> = {
    [ErrorType.USER_INPUT_ERROR]: ErrorSeverity.LOW,
    [ErrorType.INVALID_DATE_TIME]: ErrorSeverity.LOW,
    [ErrorType.INVALID_DURATION]: ErrorSeverity.LOW,
    [ErrorType.MISSING_REQUIRED_FIELD]: ErrorSeverity.LOW,

    [ErrorType.SYSTEM_ERROR]: ErrorSeverity.HIGH,
    [ErrorType.SESSION_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.DATA_CORRUPTION]: ErrorSeverity.CRITICAL,
    [ErrorType.CONFIGURATION_ERROR]: ErrorSeverity.HIGH,

    [ErrorType.EXTERNAL_API_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.GOOGLE_CALENDAR_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.CLOUDFLARE_AI_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.WEATHER_API_ERROR]: ErrorSeverity.LOW,
    [ErrorType.TRAFFIC_API_ERROR]: ErrorSeverity.LOW,

    [ErrorType.NETWORK_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.TIMEOUT_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.CONNECTION_ERROR]: ErrorSeverity.MEDIUM,

    [ErrorType.AUTHENTICATION_ERROR]: ErrorSeverity.HIGH,
    [ErrorType.AUTHORIZATION_ERROR]: ErrorSeverity.HIGH,
    [ErrorType.TOKEN_EXPIRED]: ErrorSeverity.MEDIUM,
    [ErrorType.INVALID_CREDENTIALS]: ErrorSeverity.HIGH,

    [ErrorType.RATE_LIMIT_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.QUOTA_EXCEEDED]: ErrorSeverity.MEDIUM,

    [ErrorType.DATA_VALIDATION_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.SCHEMA_VALIDATION_ERROR]: ErrorSeverity.MEDIUM,
    [ErrorType.BUSINESS_RULE_VIOLATION]: ErrorSeverity.MEDIUM,

    [ErrorType.SCHEDULE_CONFLICT]: ErrorSeverity.LOW,
    [ErrorType.RESOURCE_CONFLICT]: ErrorSeverity.MEDIUM,
    [ErrorType.CONSTRAINT_VIOLATION]: ErrorSeverity.MEDIUM,
  };

  return severityMap[errorType] || ErrorSeverity.MEDIUM;
}

/**
 * Create a SystemError instance with proper defaults
 */
export function createSystemError(
  type: ErrorType,
  message: string,
  context: Partial<ErrorContext>,
  originalError?: Error,
): SystemError {
  const errorId = generateErrorId();
  const severity = getErrorSeverity(type);
  const suggestions = DEFAULT_RECOVERY_SUGGESTIONS[type] || [];

  const errorTemplate = ERROR_MESSAGES[type];
  const userMessage = errorTemplate
    ? errorTemplate.template.replace("{details}", message)
    : message;

  return {
    type,
    code: `${type.toUpperCase()}_${Date.now()}`,
    message,
    userMessage,
    severity,
    suggestions,
    recoverable: suggestions.length > 0,
    retryable: suggestions.some((s) => s.type === RecoveryType.RETRY),
    context: {
      operationType: "unknown",
      operationStep: "unknown",
      timestamp: Date.now(),
      ...context,
    },
    originalError,
    timestamp: Date.now(),
    errorId,
  };
}
