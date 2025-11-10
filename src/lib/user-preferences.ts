// src/lib/user-preferences.ts
// User preferences and personalization data models

/**
 * User interface preferences
 */
export interface UIPreferences {
    // Interaction style preferences
    preferredInteractionStyle: 'quick_reply' | 'natural_language' | 'mixed';
    showDetailedConfirmations: boolean;
    enableSmartSuggestions: boolean;
    showProgressIndicators: boolean;

    // Display preferences
    dateFormat: 'MM/DD' | 'DD/MM' | 'YYYY-MM-DD';
    timeFormat: '12h' | '24h';
    timezone: string; // e.g., 'Asia/Tokyo'
    language: 'ja' | 'en';

    // Quick reply preferences
    maxQuickReplyItems: number;
    showIconsInQuickReply: boolean;
    enableQuickReplyShortcuts: boolean;

    // Error handling preferences
    showTechnicalDetails: boolean;
    enableAutoRetry: boolean;
    maxRetryAttempts: number;
}

/**
 * Notification preferences
 */
export interface NotificationPreferences {
    // Global notification settings
    enabled: boolean;
    quietHours: QuietHours[];

    // Default reminder settings
    defaultReminderMinutes: number;
    enableMultipleReminders: boolean;
    reminderTimings: number[]; // Minutes before event

    // Event type specific settings
    eventTypeSettings: EventTypeNotificationSettings[];

    // Content preferences
    includeWeatherInfo: boolean;
    includeTrafficInfo: boolean;
    includeLocationDetails: boolean;

    // Delivery preferences
    maxNotificationsPerHour: number;
    enableBatchNotifications: boolean;
    snoozeOptions: number[]; // Minutes for snooze

    // Priority rules
    priorityRules: PriorityRule[];

    // Multi-stage reminder settings
    multiStageSettings?: MultiStageReminderSettings;
}

/**
 * Quiet hours configuration
 */
export interface QuietHours {
    id: string;
    name: string;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    daysOfWeek: number[]; // 0-6, Sunday = 0
    enabled: boolean;
    allowUrgent: boolean; // Allow urgent notifications during quiet hours
}

/**
 * Event type notification settings
 */
export interface EventTypeNotificationSettings {
    eventType: string; // e.g., 'meeting', 'personal', 'travel'
    enabled: boolean;
    reminderMinutes: number[];
    priority: NotificationPriority;
    customMessage?: string;
    includePreparationTime: boolean;
    useMultiStage?: boolean;
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
    LOW = 'low',
    NORMAL = 'normal',
    HIGH = 'high',
    URGENT = 'urgent'
}

/**
 * Priority rules for notifications
 */
export interface PriorityRule {
    id: string;
    name: string;
    conditions: PriorityCondition[];
    priority: NotificationPriority;
    enabled: boolean;
}

/**
 * Conditions for priority rules
 */
export interface PriorityCondition {
    field: 'title' | 'location' | 'duration' | 'attendees' | 'time_of_day';
    operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
    value: string | number;
}

/**
 * AI learning preferences
 */
export interface AILearningPreferences {
    // Learning enablement
    enableLearning: boolean;
    enableLocationLearning: boolean;
    enableTimePatternLearning: boolean;
    enableEventTypeLearning: boolean;

    // Data retention
    dataRetentionDays: number;
    maxLearningEntries: number;

    // Learning sensitivity
    learningThreshold: number; // Minimum occurrences to establish pattern
    suggestionConfidenceThreshold: number; // Minimum confidence to show suggestion

    // Privacy settings
    allowDataSharing: boolean;
    anonymizeData: boolean;

    // Feedback settings
    enableFeedbackCollection: boolean;
    enableImplicitFeedback: boolean; // Learn from user actions
}

/**
 * Default values for various operations
 */
export interface DefaultValues {
    // Event defaults
    defaultEventDuration: number; // Minutes
    defaultReminderTime: number; // Minutes before event
    defaultLocation?: string;

    // Common locations (learned or manually set)
    frequentLocations: FrequentLocation[];

    // Common event types
    commonEventTypes: string[];

    // Time preferences
    preferredMeetingTimes: TimeSlot[];
    workingHours: WorkingHours;

    // Calendar preferences
    defaultCalendarId: string;
    enableConflictDetection: boolean;
    bufferTimeBetweenEvents: number; // Minutes
}

/**
 * Frequent location data
 */
export interface FrequentLocation {
    name: string;
    address?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    frequency: number; // Usage count
    lastUsed: number; // Timestamp
    category: 'work' | 'home' | 'meeting' | 'other';
    travelTimeMinutes?: number; // From default location
}

/**
 * Time slot definition
 */
export interface TimeSlot {
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    daysOfWeek: number[]; // 0-6, Sunday = 0
}

/**
 * Working hours configuration
 */
export interface WorkingHours {
    enabled: boolean;
    schedule: DaySchedule[];
    timezone: string;
    includeBreaks: boolean;
    breaks: TimeSlot[];
}

/**
 * Daily schedule
 */
export interface DaySchedule {
    dayOfWeek: number; // 0-6, Sunday = 0
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
}

/**
 * Comprehensive user preferences
 */
export interface UserPreferences {
    // Core identification
    userId: string;
    version: string; // For migration purposes

    // Preference categories
    ui: UIPreferences;
    notifications: NotificationPreferences;
    aiLearning: AILearningPreferences;
    defaults: DefaultValues;

    // Metadata
    createdAt: number;
    updatedAt: number;
    lastSyncAt?: number;

    // Feature flags
    enabledFeatures: string[];
    betaFeatures: string[];

    // Accessibility
    accessibility: AccessibilityPreferences;
}

/**
 * Accessibility preferences
 */
export interface AccessibilityPreferences {
    // Visual preferences
    highContrast: boolean;
    largeText: boolean;
    reduceMotion: boolean;

    // Interaction preferences
    enableVoiceCommands: boolean;
    enableKeyboardShortcuts: boolean;
    slowAnimations: boolean;

    // Content preferences
    verboseDescriptions: boolean;
    simplifiedInterface: boolean;
    enableScreenReader: boolean;
}

/**
 * Preference validation rules
 */
export interface PreferenceValidationRule {
    field: string;
    required: boolean;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    min?: number;
    max?: number;
    allowedValues?: any[];
    pattern?: RegExp;
    customValidator?: (value: any) => boolean;
}

/**
 * Preference update result
 */
export interface PreferenceUpdateResult {
    success: boolean;
    message: string;
    updatedFields: string[];
    validationErrors: ValidationError[];
    warnings: string[];
}

/**
 * Validation error
 */
export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value: any;
}

/**
 * Default user preferences
 */
export const DEFAULT_USER_PREFERENCES: Omit<UserPreferences, 'userId' | 'createdAt' | 'updatedAt'> = {
    version: '1.0.0',

    ui: {
        preferredInteractionStyle: 'mixed',
        showDetailedConfirmations: true,
        enableSmartSuggestions: true,
        showProgressIndicators: true,
        dateFormat: 'MM/DD',
        timeFormat: '24h',
        timezone: 'Asia/Tokyo',
        language: 'ja',
        maxQuickReplyItems: 8,
        showIconsInQuickReply: true,
        enableQuickReplyShortcuts: false,
        showTechnicalDetails: false,
        enableAutoRetry: true,
        maxRetryAttempts: 3
    },

    notifications: {
        enabled: true,
        quietHours: [
            {
                id: 'night',
                name: '夜間',
                startTime: '22:00',
                endTime: '07:00',
                daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
                enabled: true,
                allowUrgent: true
            }
        ],
        defaultReminderMinutes: 30,
        enableMultipleReminders: false,
        reminderTimings: [30],
        eventTypeSettings: [],
        includeWeatherInfo: true,
        includeTrafficInfo: true,
        includeLocationDetails: true,
        maxNotificationsPerHour: 10,
        enableBatchNotifications: false,
        snoozeOptions: [5, 10, 15, 30],
        priorityRules: []
    },

    aiLearning: {
        enableLearning: true,
        enableLocationLearning: true,
        enableTimePatternLearning: true,
        enableEventTypeLearning: true,
        dataRetentionDays: 90,
        maxLearningEntries: 1000,
        learningThreshold: 3,
        suggestionConfidenceThreshold: 0.7,
        allowDataSharing: false,
        anonymizeData: true,
        enableFeedbackCollection: true,
        enableImplicitFeedback: true
    },

    defaults: {
        defaultEventDuration: 60,
        defaultReminderTime: 30,
        frequentLocations: [],
        commonEventTypes: ['会議', 'ミーティング', '打合せ', '面談', '研修'],
        preferredMeetingTimes: [
            {
                startTime: '09:00',
                endTime: '12:00',
                daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
            },
            {
                startTime: '14:00',
                endTime: '17:00',
                daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
            }
        ],
        workingHours: {
            enabled: true,
            schedule: [
                { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '18:00' }, // Monday
                { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '18:00' }, // Tuesday
                { dayOfWeek: 3, enabled: true, startTime: '09:00', endTime: '18:00' }, // Wednesday
                { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '18:00' }, // Thursday
                { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '18:00' }, // Friday
                { dayOfWeek: 6, enabled: false, startTime: '09:00', endTime: '18:00' }, // Saturday
                { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '18:00' }  // Sunday
            ],
            timezone: 'Asia/Tokyo',
            includeBreaks: true,
            breaks: [
                {
                    startTime: '12:00',
                    endTime: '13:00',
                    daysOfWeek: [1, 2, 3, 4, 5] // Lunch break Monday to Friday
                }
            ]
        },
        defaultCalendarId: 'primary',
        enableConflictDetection: true,
        bufferTimeBetweenEvents: 15
    },

    enabledFeatures: [
        'smart_suggestions',
        'ai_scheduling',
        'conflict_detection',
        'weather_integration',
        'traffic_integration'
    ],

    betaFeatures: [],

    accessibility: {
        highContrast: false,
        largeText: false,
        reduceMotion: false,
        enableVoiceCommands: false,
        enableKeyboardShortcuts: false,
        slowAnimations: false,
        verboseDescriptions: false,
        simplifiedInterface: false,
        enableScreenReader: false
    }
};

/**
 * Preference validation rules
 */
export const PREFERENCE_VALIDATION_RULES: PreferenceValidationRule[] = [
    // UI preferences
    { field: 'ui.preferredInteractionStyle', required: true, type: 'string', allowedValues: ['quick_reply', 'natural_language', 'mixed'] },
    { field: 'ui.dateFormat', required: true, type: 'string', allowedValues: ['MM/DD', 'DD/MM', 'YYYY-MM-DD'] },
    { field: 'ui.timeFormat', required: true, type: 'string', allowedValues: ['12h', '24h'] },
    { field: 'ui.language', required: true, type: 'string', allowedValues: ['ja', 'en'] },
    { field: 'ui.maxQuickReplyItems', required: true, type: 'number', min: 3, max: 13 },
    { field: 'ui.maxRetryAttempts', required: true, type: 'number', min: 0, max: 5 },

    // Notification preferences
    { field: 'notifications.defaultReminderMinutes', required: true, type: 'number', min: 0, max: 1440 },
    { field: 'notifications.maxNotificationsPerHour', required: true, type: 'number', min: 1, max: 60 },

    // AI learning preferences
    { field: 'aiLearning.dataRetentionDays', required: true, type: 'number', min: 1, max: 365 },
    { field: 'aiLearning.maxLearningEntries', required: true, type: 'number', min: 10, max: 10000 },
    { field: 'aiLearning.learningThreshold', required: true, type: 'number', min: 1, max: 10 },
    { field: 'aiLearning.suggestionConfidenceThreshold', required: true, type: 'number', min: 0.1, max: 1.0 },

    // Default values
    { field: 'defaults.defaultEventDuration', required: true, type: 'number', min: 15, max: 480 },
    { field: 'defaults.defaultReminderTime', required: true, type: 'number', min: 0, max: 1440 },
    { field: 'defaults.bufferTimeBetweenEvents', required: true, type: 'number', min: 0, max: 60 }
];

/**
 * Utility functions for preference management
 */
export class PreferenceUtils {
    /**
     * Validate user preferences
     */
    static validatePreferences(preferences: Partial<UserPreferences>): ValidationError[] {
        const errors: ValidationError[] = [];

        for (const rule of PREFERENCE_VALIDATION_RULES) {
            const value = this.getNestedValue(preferences, rule.field);

            // Check required fields
            if (rule.required && (value === undefined || value === null)) {
                errors.push({
                    field: rule.field,
                    message: `Field ${rule.field} is required`,
                    code: 'REQUIRED_FIELD_MISSING',
                    value
                });
                continue;
            }

            if (value === undefined || value === null) continue;

            // Check type
            if (typeof value !== rule.type) {
                errors.push({
                    field: rule.field,
                    message: `Field ${rule.field} must be of type ${rule.type}`,
                    code: 'INVALID_TYPE',
                    value
                });
                continue;
            }

            // Check numeric ranges
            if (rule.type === 'number') {
                if (rule.min !== undefined && value < rule.min) {
                    errors.push({
                        field: rule.field,
                        message: `Field ${rule.field} must be at least ${rule.min}`,
                        code: 'VALUE_TOO_SMALL',
                        value
                    });
                }
                if (rule.max !== undefined && value > rule.max) {
                    errors.push({
                        field: rule.field,
                        message: `Field ${rule.field} must be at most ${rule.max}`,
                        code: 'VALUE_TOO_LARGE',
                        value
                    });
                }
            }

            // Check allowed values
            if (rule.allowedValues && !rule.allowedValues.includes(value)) {
                errors.push({
                    field: rule.field,
                    message: `Field ${rule.field} must be one of: ${rule.allowedValues.join(', ')}`,
                    code: 'INVALID_VALUE',
                    value
                });
            }

            // Check pattern
            if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
                errors.push({
                    field: rule.field,
                    message: `Field ${rule.field} does not match required pattern`,
                    code: 'PATTERN_MISMATCH',
                    value
                });
            }

            // Custom validator
            if (rule.customValidator && !rule.customValidator(value)) {
                errors.push({
                    field: rule.field,
                    message: `Field ${rule.field} failed custom validation`,
                    code: 'CUSTOM_VALIDATION_FAILED',
                    value
                });
            }
        }

        return errors;
    }

    /**
     * Merge preferences with defaults
     */
    static mergeWithDefaults(
        userPreferences: Partial<UserPreferences>,
        userId: string
    ): UserPreferences {
        const now = Date.now();

        return {
            ...DEFAULT_USER_PREFERENCES,
            ...userPreferences,
            userId,
            createdAt: userPreferences.createdAt || now,
            updatedAt: now,
            ui: {
                ...DEFAULT_USER_PREFERENCES.ui,
                ...userPreferences.ui
            },
            notifications: {
                ...DEFAULT_USER_PREFERENCES.notifications,
                ...userPreferences.notifications,
                quietHours: userPreferences.notifications?.quietHours || DEFAULT_USER_PREFERENCES.notifications.quietHours,
                eventTypeSettings: userPreferences.notifications?.eventTypeSettings || [],
                priorityRules: userPreferences.notifications?.priorityRules || []
            },
            aiLearning: {
                ...DEFAULT_USER_PREFERENCES.aiLearning,
                ...userPreferences.aiLearning
            },
            defaults: {
                ...DEFAULT_USER_PREFERENCES.defaults,
                ...userPreferences.defaults,
                frequentLocations: userPreferences.defaults?.frequentLocations || [],
                commonEventTypes: userPreferences.defaults?.commonEventTypes || DEFAULT_USER_PREFERENCES.defaults.commonEventTypes,
                preferredMeetingTimes: userPreferences.defaults?.preferredMeetingTimes || DEFAULT_USER_PREFERENCES.defaults.preferredMeetingTimes,
                workingHours: {
                    ...DEFAULT_USER_PREFERENCES.defaults.workingHours,
                    ...userPreferences.defaults?.workingHours
                }
            },
            enabledFeatures: userPreferences.enabledFeatures || DEFAULT_USER_PREFERENCES.enabledFeatures,
            betaFeatures: userPreferences.betaFeatures || [],
            accessibility: {
                ...DEFAULT_USER_PREFERENCES.accessibility,
                ...userPreferences.accessibility
            }
        };
    }

    /**
     * Get nested value from object using dot notation
     */
    private static getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Set nested value in object using dot notation
     */
    static setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop()!;
        const target = keys.reduce((current, key) => {
            if (!(key in current)) {
                current[key] = {};
            }
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    /**
     * Generate preference migration plan
     */
    static generateMigrationPlan(
        currentVersion: string,
        targetVersion: string
    ): string[] {
        const migrations: string[] = [];

        // Example migration paths
        if (currentVersion === '0.9.0' && targetVersion === '1.0.0') {
            migrations.push('add_accessibility_preferences');
            migrations.push('update_notification_structure');
            migrations.push('add_working_hours');
        }

        return migrations;
    }

    /**
     * Check if user has feature enabled
     */
    static hasFeatureEnabled(preferences: UserPreferences, feature: string): boolean {
        return preferences.enabledFeatures.includes(feature) ||
            preferences.betaFeatures.includes(feature);
    }

    /**
     * Get effective quiet hours for current time
     */
    static getActiveQuietHours(preferences: UserPreferences, timestamp: number = Date.now()): QuietHours | null {
        const date = new Date(timestamp);
        const dayOfWeek = date.getDay();
        const timeString = date.toTimeString().slice(0, 5); // HH:MM format

        for (const quietHour of preferences.notifications.quietHours) {
            if (!quietHour.enabled || !quietHour.daysOfWeek.includes(dayOfWeek)) {
                continue;
            }

            // Handle time ranges that cross midnight
            if (quietHour.startTime > quietHour.endTime) {
                if (timeString >= quietHour.startTime || timeString <= quietHour.endTime) {
                    return quietHour;
                }
            } else {
                if (timeString >= quietHour.startTime && timeString <= quietHour.endTime) {
                    return quietHour;
                }
            }
        }

        return null;
    }
}/*
*
 * Multi-stage reminder settings
 */
export interface MultiStageReminderSettings {
    enabled: boolean;
    defaultStages: string[]; // Stage IDs to use by default
    customStages: CustomReminderStage[];
    escalationEnabled: boolean;
    snoozeSettings: SnoozeSettings;
}

/**
 * Custom reminder stage
 */
export interface CustomReminderStage {
    id: string;
    name: string;
    minutesBefore: number;
    priority: NotificationPriority;
    conditions?: StageCondition[];
    customMessage?: string;
}

/**
 * Stage condition
 */
export interface StageCondition {
    type: 'importance' | 'eventType' | 'timeOfDay' | 'dayOfWeek' | 'duration';
    operator: 'equals' | 'greaterThan' | 'lessThan' | 'contains' | 'in';
    value: any;
}

/**
 * Snooze settings
 */
export interface SnoozeSettings {
    enabled: boolean;
    defaultMinutes: number;
    maxSnoozes: number;
    availableOptions: number[];
    escalateAfterMaxSnoozes: boolean;
}