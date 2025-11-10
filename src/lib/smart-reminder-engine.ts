// src/lib/smart-reminder-engine.ts
// Smart reminder engine with intelligent timing and context awareness

import { getUserPreferences } from "./preferences-api";
import { stashPostbackPayload, popPostbackPayload, addReminder, removeReminderByEventId } from "./kv";
import { createSystemError, ErrorType } from "./errors";
import { NotificationPriority, EventTypeNotificationSettings } from "./user-preferences";
import { contextAwareScheduler, ContextAdjustment } from "./context-aware-scheduler";
import { multiStageReminderManager } from "./multi-stage-reminder";
import { customizableNotificationSystem, NotificationContext } from "./notification-system";

/**
 * Enhanced reminder with smart features
 */
export interface SmartReminder {
    id: string;
    eventId: string;
    userId: string;
    groupId?: string;

    // Basic reminder info
    summary: string;
    eventStart: string;
    reminderAt: number;

    // Smart features
    reminderType: ReminderType;
    priority: NotificationPriority;
    customMessage?: string;

    // Context information
    eventContext: EventContext;
    weatherDependent: boolean;
    trafficDependent: boolean;
    preparationTime?: number;
    contextAdjustment?: ContextAdjustment;
    isMultiStage?: boolean;
    stageId?: string;

    // Delivery tracking
    deliveryStatus: DeliveryStatus;
    deliveryAttempts: number;
    lastDeliveryAttempt?: number;

    // User interaction
    userResponse?: UserResponse;
    snoozeCount: number;
    snoozedUntil?: number;

    // Metadata
    createdAt: number;
    updatedAt: number;
}

/**
 * Types of smart reminders
 */
export enum ReminderType {
    STANDARD = 'standard',
    PREPARATION = 'preparation',
    DEPARTURE = 'departure',
    WEATHER_ALERT = 'weather_alert',
    TRAFFIC_ALERT = 'traffic_alert',
    FOLLOW_UP = 'follow_up',
    ESCALATION = 'escalation'
}

/**
 * Event context for smart reminders
 */
export interface EventContext {
    location?: LocationInfo;
    attendees?: string[];
    eventType?: string;
    importance?: 'low' | 'normal' | 'high' | 'critical';
    isRecurring?: boolean;
    hasPreparation?: boolean;
    requiresTravel?: boolean;
}

/**
 * Location information
 */
export interface LocationInfo {
    name: string;
    address?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    travelTimeMinutes?: number;
    transportMode?: 'walking' | 'driving' | 'transit' | 'cycling';
}

/**
 * Weather information
 */
export interface WeatherInfo {
    condition: string;
    temperature: number;
    precipitation: number;
    windSpeed: number;
    alerts?: string[];
    recommendation?: string;
}

/**
 * Traffic information
 */
export interface TrafficInfo {
    duration: number;
    durationInTraffic: number;
    distance: number;
    route: string;
    alerts?: string[];
    recommendation?: string;
}

/**
 * Delivery status
 */
export enum DeliveryStatus {
    PENDING = 'pending',
    SENT = 'sent',
    DELIVERED = 'delivered',
    FAILED = 'failed',
    SNOOZED = 'snoozed',
    CANCELLED = 'cancelled'
}

/**
 * User response to reminder
 */
export interface UserResponse {
    type: ResponseType;
    timestamp: number;
    data?: any;
}

/**
 * Response types
 */
export enum ResponseType {
    ACKNOWLEDGED = 'acknowledged',
    SNOOZED = 'snoozed',
    DISMISSED = 'dismissed',
    RESCHEDULED = 'rescheduled',
    CANCELLED = 'cancelled'
}

/**
 * Reminder timing calculation result
 */
export interface ReminderTiming {
    reminderAt: number;
    type: ReminderType;
    message: string;
    priority: NotificationPriority;
    contextFactors: string[];
}

/**
 * Smart Reminder Engine
 */
export class SmartReminderEngine {
    private static instance: SmartReminderEngine;
    private readonly REMINDER_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

    private constructor() { }

    static getInstance(): SmartReminderEngine {
        if (!SmartReminderEngine.instance) {
            SmartReminderEngine.instance = new SmartReminderEngine();
        }
        return SmartReminderEngine.instance;
    }

    /**
     * Schedule smart reminder for an event
     */
    async scheduleSmartReminder(
        eventId: string,
        userId: string,
        eventData: {
            summary: string;
            start: string;
            end: string;
            location?: string;
            description?: string;
        },
        groupId?: string,
        useMultiStage: boolean = true
    ): Promise<string[]> {
        try {
            // Get user preferences
            const preferences = await getUserPreferences(userId);

            // Build event context
            const eventContext = await this.buildEventContext(eventData, preferences);

            let reminderIds: string[] = [];

            // Use multi-stage reminders for important events or when explicitly requested
            if (useMultiStage && (eventContext.importance === 'high' || eventContext.importance === 'critical')) {
                try {
                    reminderIds = await multiStageReminderManager.createMultiStageReminders(
                        eventId,
                        userId,
                        eventData,
                        eventContext,
                        groupId
                    );
                } catch (error) {
                    console.error('Multi-stage reminder creation failed, falling back to standard:', error);
                    useMultiStage = false;
                }
            }

            // Fall back to standard reminders if multi-stage is not used or failed
            if (!useMultiStage || reminderIds.length === 0) {
                // Calculate optimal reminder timings
                const reminderTimings = await this.calculateOptimalReminderTimes(
                    eventData,
                    eventContext,
                    preferences
                );

                // Create smart reminders for each timing
                for (const timing of reminderTimings) {
                    const reminderId = await this.createSmartReminder(
                        eventId,
                        userId,
                        eventData,
                        timing,
                        eventContext,
                        groupId
                    );
                    reminderIds.push(reminderId);
                }
            }

            console.log(`Scheduled ${reminderIds.length} smart reminders for event ${eventId}`);
            return reminderIds;

        } catch (error) {
            console.error('Failed to schedule smart reminder:', error);
            throw createSystemError(
                ErrorType.SYSTEM_ERROR,
                'Failed to schedule smart reminder',
                { userId, operationType: 'schedule_reminder', operationStep: 'scheduling', additionalData: { eventId } },
                error as Error
            );
        }
    }

    /**
     * Update reminders when event changes
     */
    async updateRemindersForEvent(
        eventId: string,
        userId: string,
        changes: {
            summary?: string;
            start?: string;
            end?: string;
            location?: string;
            description?: string;
        }
    ): Promise<void> {
        try {
            // Get existing reminders
            const existingReminders = await this.getEventReminders(eventId);

            // Cancel existing reminders
            for (const reminder of existingReminders) {
                await this.cancelReminder(reminder.id);
            }

            // Get updated event data
            const eventData = await this.getEventData(eventId, changes);

            // Schedule new reminders with updated data
            await this.scheduleSmartReminder(eventId, userId, eventData);

            console.log(`Updated reminders for event ${eventId}`);

        } catch (error) {
            console.error('Failed to update reminders:', error);
            throw createSystemError(
                ErrorType.SYSTEM_ERROR,
                'Failed to update reminders',
                { userId, operationType: 'update_reminders', operationStep: 'updating', additionalData: { eventId } },
                error as Error
            );
        }
    }

    /**
     * Cancel all reminders for an event
     */
    async cancelRemindersForEvent(eventId: string): Promise<void> {
        try {
            // Remove from KV reminder system
            await removeReminderByEventId(eventId);

            // Get and cancel smart reminders
            const smartReminders = await this.getEventReminders(eventId);
            for (const reminder of smartReminders) {
                await this.cancelReminder(reminder.id);
            }

            console.log(`Cancelled all reminders for event ${eventId}`);

        } catch (error) {
            console.error('Failed to cancel reminders:', error);
            throw createSystemError(
                ErrorType.SYSTEM_ERROR,
                'Failed to cancel reminders',
                { operationType: 'cancel_reminders', operationStep: 'cancelling', additionalData: { eventId } },
                error as Error
            );
        }
    }

    /**
     * Process user response to reminder
     */
    async processUserResponse(
        reminderId: string,
        response: UserResponse
    ): Promise<void> {
        try {
            const reminder = await this.getSmartReminder(reminderId);
            if (!reminder) {
                throw new Error('Reminder not found');
            }

            // Update reminder with user response
            reminder.userResponse = response;
            reminder.updatedAt = Date.now();

            switch (response.type) {
                case ResponseType.SNOOZED:
                    await this.snoozeReminder(reminder, response.data?.snoozeMinutes || 10);
                    break;

                case ResponseType.DISMISSED:
                    reminder.deliveryStatus = DeliveryStatus.CANCELLED;
                    break;

                case ResponseType.RESCHEDULED:
                    await this.rescheduleReminder(reminder, response.data?.newTime);
                    break;

                case ResponseType.ACKNOWLEDGED:
                    reminder.deliveryStatus = DeliveryStatus.DELIVERED;
                    break;
            }

            await this.updateSmartReminder(reminder);

        } catch (error) {
            console.error('Failed to process user response:', error);
            throw createSystemError(
                ErrorType.SYSTEM_ERROR,
                'Failed to process user response',
                { operationType: 'process_response', operationStep: 'processing', additionalData: { reminderId } },
                error as Error
            );
        }
    }

    /**
     * Get reminder statistics for user
     */
    async getReminderStats(userId: string): Promise<any> {
        try {
            const reminders = await this.getUserReminders(userId);

            const stats = {
                total: reminders.length,
                byType: {} as Record<ReminderType, number>,
                byStatus: {} as Record<DeliveryStatus, number>,
                averageResponseTime: 0,
                snoozeRate: 0,
                deliveryRate: 0
            };

            let totalResponseTime = 0;
            let responseCount = 0;
            let snoozeCount = 0;
            let deliveredCount = 0;

            for (const reminder of reminders) {
                // Count by type
                stats.byType[reminder.reminderType] = (stats.byType[reminder.reminderType] || 0) + 1;

                // Count by status
                stats.byStatus[reminder.deliveryStatus] = (stats.byStatus[reminder.deliveryStatus] || 0) + 1;

                // Calculate response metrics
                if (reminder.userResponse) {
                    const responseTime = reminder.userResponse.timestamp - reminder.reminderAt;
                    totalResponseTime += responseTime;
                    responseCount++;

                    if (reminder.userResponse.type === ResponseType.SNOOZED) {
                        snoozeCount++;
                    }
                }

                if (reminder.deliveryStatus === DeliveryStatus.DELIVERED) {
                    deliveredCount++;
                }
            }

            stats.averageResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;
            stats.snoozeRate = reminders.length > 0 ? snoozeCount / reminders.length : 0;
            stats.deliveryRate = reminders.length > 0 ? deliveredCount / reminders.length : 0;

            return stats;

        } catch (error) {
            console.error('Failed to get reminder stats:', error);
            return {
                total: 0,
                byType: {},
                byStatus: {},
                averageResponseTime: 0,
                snoozeRate: 0,
                deliveryRate: 0
            };
        }
    }    /**
  
   * Calculate optimal reminder times based on context
     */
    private async calculateOptimalReminderTimes(
        eventData: any,
        eventContext: EventContext,
        preferences: any
    ): Promise<ReminderTiming[]> {
        const timings: ReminderTiming[] = [];
        const eventStart = new Date(eventData.start).getTime();
        const now = Date.now();

        // Get user's notification preferences
        const notificationPrefs = preferences.notifications;
        const defaultMinutes = notificationPrefs.defaultReminderMinutes || 30;

        // Context-aware standard reminder
        try {
            const contextAdjustment = await contextAwareScheduler.calculateContextAwareReminder(
                eventStart,
                eventContext,
                preferences.userId || 'default',
                defaultMinutes
            );

            if (contextAdjustment.adjustedTime > now) {
                timings.push({
                    reminderAt: contextAdjustment.adjustedTime,
                    type: ReminderType.STANDARD,
                    message: this.generateContextAwareMessage(eventData, ReminderType.STANDARD, contextAdjustment),
                    priority: NotificationPriority.NORMAL,
                    contextFactors: ['user_preference', 'weather', 'traffic', 'time_of_day']
                });
            }
        } catch (error) {
            console.error('Failed to calculate context-aware timing, using standard:', error);
            // Fallback to standard timing
            const standardReminderTime = eventStart - (defaultMinutes * 60 * 1000);
            if (standardReminderTime > now) {
                timings.push({
                    reminderAt: standardReminderTime,
                    type: ReminderType.STANDARD,
                    message: this.generateReminderMessage(eventData, ReminderType.STANDARD),
                    priority: NotificationPriority.NORMAL,
                    contextFactors: ['user_preference']
                });
            }
        }

        // Preparation reminder for events that need preparation
        if (eventContext.hasPreparation) {
            const preparationTime = this.calculatePreparationTime(eventContext);
            const preparationReminderTime = eventStart - preparationTime - (defaultMinutes * 60 * 1000);

            if (preparationReminderTime > now) {
                timings.push({
                    reminderAt: preparationReminderTime,
                    type: ReminderType.PREPARATION,
                    message: this.generateReminderMessage(eventData, ReminderType.PREPARATION, { preparationTime }),
                    priority: NotificationPriority.NORMAL,
                    contextFactors: ['preparation_needed']
                });
            }
        }

        // Context-aware departure reminder for events requiring travel
        if (eventContext.requiresTravel && eventContext.location?.travelTimeMinutes) {
            try {
                // Calculate departure time with traffic consideration
                const baseTravelTime = eventContext.location.travelTimeMinutes * 60 * 1000;
                const baseDepartureTime = eventStart - baseTravelTime - (15 * 60 * 1000); // 15 min buffer

                const departureAdjustment = await contextAwareScheduler.calculateContextAwareReminder(
                    eventStart,
                    eventContext,
                    preferences.userId || 'default',
                    Math.round(baseTravelTime / (60 * 1000)) + 15 // Travel time + buffer in minutes
                );

                if (departureAdjustment.adjustedTime > now) {
                    timings.push({
                        reminderAt: departureAdjustment.adjustedTime,
                        type: ReminderType.DEPARTURE,
                        message: this.generateContextAwareMessage(eventData, ReminderType.DEPARTURE, departureAdjustment),
                        priority: NotificationPriority.HIGH,
                        contextFactors: ['travel_required', 'traffic_dependent', 'weather_dependent']
                    });
                }
            } catch (error) {
                console.error('Failed to calculate context-aware departure time, using standard:', error);
                // Fallback to standard departure timing
                const travelTime = eventContext.location.travelTimeMinutes * 60 * 1000;
                const departureReminderTime = eventStart - travelTime - (15 * 60 * 1000);

                if (departureReminderTime > now) {
                    timings.push({
                        reminderAt: departureReminderTime,
                        type: ReminderType.DEPARTURE,
                        message: this.generateReminderMessage(eventData, ReminderType.DEPARTURE, {
                            travelTime: eventContext.location.travelTimeMinutes
                        }),
                        priority: NotificationPriority.HIGH,
                        contextFactors: ['travel_required', 'traffic_dependent']
                    });
                }
            }
        }

        // Event-type specific reminders
        const eventTypeSettings = this.getEventTypeSettings(eventContext.eventType, notificationPrefs);
        if (eventTypeSettings) {
            for (const minutes of eventTypeSettings.reminderMinutes) {
                const reminderTime = eventStart - (minutes * 60 * 1000);
                if (reminderTime > now) {
                    timings.push({
                        reminderAt: reminderTime,
                        type: ReminderType.STANDARD,
                        message: eventTypeSettings.customMessage ||
                            this.generateReminderMessage(eventData, ReminderType.STANDARD),
                        priority: eventTypeSettings.priority,
                        contextFactors: ['event_type_specific']
                    });
                }
            }
        }

        // High importance events get additional reminders
        if (eventContext.importance === 'critical') {
            const criticalReminders = [
                { minutes: 24 * 60, type: ReminderType.STANDARD }, // 1 day before
                { minutes: 4 * 60, type: ReminderType.STANDARD },  // 4 hours before
                { minutes: 60, type: ReminderType.STANDARD },      // 1 hour before
                { minutes: 15, type: ReminderType.STANDARD }       // 15 minutes before
            ];

            for (const reminder of criticalReminders) {
                const reminderTime = eventStart - (reminder.minutes * 60 * 1000);
                if (reminderTime > now) {
                    timings.push({
                        reminderAt: reminderTime,
                        type: reminder.type,
                        message: this.generateReminderMessage(eventData, reminder.type),
                        priority: NotificationPriority.HIGH,
                        contextFactors: ['high_importance']
                    });
                }
            }
        }

        // Remove duplicates and sort by time
        const uniqueTimings = this.deduplicateTimings(timings);
        return uniqueTimings.sort((a, b) => a.reminderAt - b.reminderAt);
    }

    /**
     * Build event context from event data and preferences
     */
    private async buildEventContext(eventData: any, preferences: any): Promise<EventContext> {
        const context: EventContext = {
            eventType: this.detectEventType(eventData.summary, eventData.description),
            importance: this.calculateImportance(eventData, preferences),
            isRecurring: false, // Would need to check calendar data
            hasPreparation: this.needsPreparation(eventData),
            requiresTravel: !!eventData.location && eventData.location !== 'オンライン'
        };

        // Build location info if present
        if (eventData.location) {
            context.location = await this.buildLocationInfo(eventData.location, preferences);
        }

        // Extract attendees if present
        if (eventData.description) {
            context.attendees = this.extractAttendees(eventData.description);
        }

        return context;
    }

    /**
     * Create a smart reminder
     */
    private async createSmartReminder(
        eventId: string,
        userId: string,
        eventData: any,
        timing: ReminderTiming,
        eventContext: EventContext,
        groupId?: string
    ): Promise<string> {
        const reminderId = this.generateReminderId();

        // Get context adjustment if this is a context-aware reminder
        let contextAdjustment: ContextAdjustment | undefined;
        if (timing.contextFactors.includes('weather') || timing.contextFactors.includes('traffic')) {
            try {
                contextAdjustment = await contextAwareScheduler.calculateContextAwareReminder(
                    new Date(eventData.start).getTime(),
                    eventContext,
                    userId,
                    30 // Default base minutes
                );
            } catch (error) {
                console.error('Failed to get context adjustment for reminder storage:', error);
            }
        }

        const reminder: SmartReminder = {
            id: reminderId,
            eventId,
            userId,
            groupId,
            summary: eventData.summary,
            eventStart: eventData.start,
            reminderAt: timing.reminderAt,
            reminderType: timing.type,
            priority: timing.priority,
            customMessage: timing.message,
            eventContext,
            weatherDependent: this.isWeatherDependent(eventContext),
            trafficDependent: this.isTrafficDependent(eventContext),
            preparationTime: eventContext.hasPreparation ? this.calculatePreparationTime(eventContext) : undefined,
            contextAdjustment,
            deliveryStatus: DeliveryStatus.PENDING,
            deliveryAttempts: 0,
            snoozeCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Store smart reminder
        await this.storeSmartReminder(reminder);

        // Also add to legacy reminder system for compatibility
        await addReminder({
            eventId,
            groupId,
            userId,
            summary: eventData.summary,
            start: eventData.start,
            reminderAt: timing.reminderAt
        });

        return reminderId;
    }

    /**
     * Generate context-aware reminder message
     */
    private generateContextAwareMessage(
        eventData: any,
        type: ReminderType,
        contextAdjustment: ContextAdjustment
    ): string {
        const baseMessage = this.generateReminderMessage(eventData, type);
        const contextInfo: string[] = [];

        // Add weather information
        if (contextAdjustment.weatherFactor) {
            const weather = contextAdjustment.weatherFactor;
            contextInfo.push(`🌤️ 天気: ${weather.condition} ${Math.round(weather.temperature)}°C`);

            if (weather.precipitation > 0.5) {
                contextInfo.push(`☔ 降水量: ${weather.precipitation}mm`);
            }

            if (weather.recommendation) {
                contextInfo.push(`💡 ${weather.recommendation}`);
            }
        }

        // Add traffic information
        if (contextAdjustment.trafficFactor) {
            const traffic = contextAdjustment.trafficFactor;
            const delay = traffic.durationInTraffic - traffic.duration;

            if (delay > 5) {
                contextInfo.push(`🚗 交通: 通常より${delay}分多くかかる予想`);
            }

            if (traffic.recommendation) {
                contextInfo.push(`🛣️ ${traffic.recommendation}`);
            }
        }

        // Add adjustment reason
        if (contextAdjustment.adjustmentMinutes > 0) {
            contextInfo.push(`⏰ ${contextAdjustment.reason}`);
        }

        // Add recommendations
        if (contextAdjustment.recommendations.length > 0) {
            contextInfo.push(...contextAdjustment.recommendations.map(rec => `📋 ${rec}`));
        }

        // Combine base message with context information
        if (contextInfo.length > 0) {
            return `${baseMessage}\n\n${contextInfo.join('\n')}`;
        }

        return baseMessage;
    }

    /**
     * Generate reminder message based on type and context
     */
    private generateReminderMessage(
        eventData: any,
        type: ReminderType,
        context?: any
    ): string {
        const summary = eventData.summary || '予定';
        const startTime = new Date(eventData.start).toLocaleString('ja-JP', {
            hour12: false,
            timeZone: 'Asia/Tokyo',
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        switch (type) {
            case ReminderType.PREPARATION:
                const prepTime = Math.round((context?.preparationTime || 0) / (60 * 1000));
                return `🔔 準備時間です: ${summary}\n開始: ${startTime}\n準備時間: ${prepTime}分`;

            case ReminderType.DEPARTURE:
                const travelTime = context?.travelTime || 0;
                return `🚗 出発時間です: ${summary}\n開始: ${startTime}\n移動時間: ${travelTime}分`;

            case ReminderType.WEATHER_ALERT:
                return `🌤️ 天気情報: ${summary}\n開始: ${startTime}\n${context?.weatherInfo || ''}`;

            case ReminderType.TRAFFIC_ALERT:
                return `🚦 交通情報: ${summary}\n開始: ${startTime}\n${context?.trafficInfo || ''}`;

            case ReminderType.FOLLOW_UP:
                return `📋 フォローアップ: ${summary}\n完了確認をお願いします`;

            case ReminderType.ESCALATION:
                return `🚨 重要: ${summary}\n開始: ${startTime}\n至急確認してください`;

            default:
                return `⏰ まもなく予定です: ${summary}\n開始: ${startTime}`;
        }
    }

    /**
     * Detect event type from title and description
     */
    private detectEventType(summary: string, description?: string): string {
        const text = `${summary} ${description || ''}`.toLowerCase();

        const eventTypes = [
            { keywords: ['会議', 'ミーティング', 'meeting'], type: 'meeting' },
            { keywords: ['面談', '面接', 'interview'], type: 'interview' },
            { keywords: ['研修', 'セミナー', 'training'], type: 'training' },
            { keywords: ['プレゼン', '発表', 'presentation'], type: 'presentation' },
            { keywords: ['会食', '飲み会', 'dinner'], type: 'social' },
            { keywords: ['移動', '出張', 'travel'], type: 'travel' },
            { keywords: ['締切', 'deadline'], type: 'deadline' }
        ];

        for (const eventType of eventTypes) {
            if (eventType.keywords.some(keyword => text.includes(keyword))) {
                return eventType.type;
            }
        }

        return 'general';
    }

    /**
     * Calculate event importance
     */
    private calculateImportance(eventData: any, preferences: any): 'low' | 'normal' | 'high' | 'critical' {
        let score = 0;

        // Check for importance keywords
        const text = `${eventData.summary} ${eventData.description || ''}`.toLowerCase();
        const importantKeywords = ['重要', '緊急', '至急', 'urgent', 'important', 'critical'];
        const highKeywords = ['会議', '面談', 'ceo', '役員', 'board'];

        if (importantKeywords.some(keyword => text.includes(keyword))) {
            score += 3;
        }

        if (highKeywords.some(keyword => text.includes(keyword))) {
            score += 2;
        }

        // Check duration (longer events might be more important)
        const duration = new Date(eventData.end).getTime() - new Date(eventData.start).getTime();
        if (duration > 2 * 60 * 60 * 1000) { // More than 2 hours
            score += 1;
        }

        // Check if it's during working hours
        const startHour = new Date(eventData.start).getHours();
        if (startHour >= 9 && startHour <= 17) {
            score += 1;
        }

        if (score >= 4) return 'critical';
        if (score >= 2) return 'high';
        if (score >= 1) return 'normal';
        return 'low';
    }

    /**
     * Check if event needs preparation
     */
    private needsPreparation(eventData: any): boolean {
        const text = `${eventData.summary} ${eventData.description || ''}`.toLowerCase();
        const preparationKeywords = [
            'プレゼン', '発表', 'presentation', '資料', '準備', 'prepare',
            '面談', 'interview', '会議', 'meeting', '研修', 'training'
        ];

        return preparationKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * Calculate preparation time needed
     */
    private calculatePreparationTime(eventContext: EventContext): number {
        const baseTime = 15 * 60 * 1000; // 15 minutes base

        switch (eventContext.eventType) {
            case 'presentation':
                return 30 * 60 * 1000; // 30 minutes
            case 'interview':
                return 20 * 60 * 1000; // 20 minutes
            case 'meeting':
                return 10 * 60 * 1000; // 10 minutes
            case 'training':
                return 15 * 60 * 1000; // 15 minutes
            default:
                return baseTime;
        }
    }

    /**
     * Build location information
     */
    private async buildLocationInfo(location: string, preferences: any): Promise<LocationInfo> {
        const locationInfo: LocationInfo = {
            name: location
        };

        // Check if it's a known frequent location
        const frequentLocations = preferences.defaults?.frequentLocations || [];
        const knownLocation = frequentLocations.find((loc: any) =>
            loc.name.toLowerCase() === location.toLowerCase()
        );

        if (knownLocation) {
            locationInfo.address = knownLocation.address;
            locationInfo.coordinates = knownLocation.coordinates;
            locationInfo.travelTimeMinutes = knownLocation.travelTimeMinutes;
        } else {
            // Estimate travel time based on location type
            locationInfo.travelTimeMinutes = this.estimateTravelTime(location);
        }

        return locationInfo;
    }

    /**
     * Estimate travel time for unknown locations
     */
    private estimateTravelTime(location: string): number {
        const text = location.toLowerCase();

        if (text.includes('オンライン') || text.includes('zoom') || text.includes('teams')) {
            return 0;
        }

        if (text.includes('会議室') || text.includes('オフィス')) {
            return 5; // 5 minutes within office
        }

        if (text.includes('駅') || text.includes('空港')) {
            return 45; // 45 minutes for stations/airports
        }

        return 30; // Default 30 minutes
    }

    /**
     * Extract attendees from description
     */
    private extractAttendees(description: string): string[] {
        const attendees: string[] = [];

        // Simple pattern matching for Japanese names and email addresses
        const namePattern = /([田中|佐藤|鈴木|高橋|渡辺|伊藤|山本|中村|小林|加藤][さん]?)/g;
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

        let match;
        while ((match = namePattern.exec(description)) !== null) {
            attendees.push(match[1]);
        }

        while ((match = emailPattern.exec(description)) !== null) {
            attendees.push(match[1]);
        }

        return attendees;
    }

    /**
     * Get event type specific settings
     */
    private getEventTypeSettings(
        eventType?: string,
        notificationPrefs?: any
    ): EventTypeNotificationSettings | null {
        if (!eventType || !notificationPrefs?.eventTypeSettings) {
            return null;
        }

        return notificationPrefs.eventTypeSettings.find(
            (setting: EventTypeNotificationSettings) => setting.eventType === eventType
        ) || null;
    }

    /**
     * Check if event is weather dependent
     */
    private isWeatherDependent(eventContext: EventContext): boolean {
        if (!eventContext.location) return false;

        const location = eventContext.location.name.toLowerCase();
        return !location.includes('オンライン') &&
            !location.includes('会議室') &&
            !location.includes('オフィス');
    }

    /**
     * Check if event is traffic dependent
     */
    private isTrafficDependent(eventContext: EventContext): boolean {
        return Boolean(eventContext.requiresTravel) &&
            eventContext.location?.travelTimeMinutes !== undefined &&
            eventContext.location.travelTimeMinutes > 10;
    }

    /**
     * Remove duplicate timings
     */
    private deduplicateTimings(timings: ReminderTiming[]): ReminderTiming[] {
        const seen = new Set<number>();
        return timings.filter(timing => {
            const key = timing.reminderAt;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    /**
     * Store smart reminder
     */
    private async storeSmartReminder(reminder: SmartReminder): Promise<void> {
        const key = `smart_reminder_${reminder.id}`;
        await stashPostbackPayload(key, JSON.stringify(reminder), this.REMINDER_TTL);

        // Add to user's reminder index
        await this.addToReminderIndex(reminder.userId, reminder.id);
    }

    /**
     * Get smart reminder
     */
    private async getSmartReminder(reminderId: string): Promise<SmartReminder | null> {
        try {
            const key = `smart_reminder_${reminderId}`;
            const data = await popPostbackPayload(key);

            if (!data) {
                return null;
            }

            const reminder: SmartReminder = JSON.parse(data);

            // Re-store reminder
            await stashPostbackPayload(key, data, this.REMINDER_TTL);

            return reminder;
        } catch (error) {
            console.error('Failed to get smart reminder:', error);
            return null;
        }
    }

    /**
     * Update smart reminder
     */
    private async updateSmartReminder(reminder: SmartReminder): Promise<void> {
        reminder.updatedAt = Date.now();
        const key = `smart_reminder_${reminder.id}`;
        await stashPostbackPayload(key, JSON.stringify(reminder), this.REMINDER_TTL);
    }

    /**
     * Get event reminders
     */
    private async getEventReminders(eventId: string): Promise<SmartReminder[]> {
        // This would require scanning reminders by event ID
        // For now, return empty array
        return [];
    }

    /**
     * Get user reminders
     */
    private async getUserReminders(userId: string): Promise<SmartReminder[]> {
        try {
            const indexKey = `reminder_index_${userId}`;
            const indexData = await popPostbackPayload(indexKey);

            if (!indexData) {
                return [];
            }

            const reminderIds: string[] = JSON.parse(indexData);
            const reminders: SmartReminder[] = [];

            // Re-store index
            await stashPostbackPayload(indexKey, indexData, this.REMINDER_TTL);

            for (const reminderId of reminderIds) {
                const reminder = await this.getSmartReminder(reminderId);
                if (reminder) {
                    reminders.push(reminder);
                }
            }

            return reminders;

        } catch (error) {
            console.error('Failed to get user reminders:', error);
            return [];
        }
    }

    /**
     * Cancel a smart reminder
     */
    private async cancelReminder(reminderId: string): Promise<void> {
        try {
            const reminder = await this.getSmartReminder(reminderId);
            if (!reminder) {
                return;
            }

            reminder.deliveryStatus = DeliveryStatus.CANCELLED;
            reminder.updatedAt = Date.now();

            await this.updateSmartReminder(reminder);

            // Remove from user's reminder index
            await this.removeFromReminderIndex(reminder.userId, reminderId);

        } catch (error) {
            console.error('Failed to cancel reminder:', error);
        }
    }

    /**
     * Snooze a reminder
     */
    private async snoozeReminder(reminder: SmartReminder, snoozeMinutes: number): Promise<void> {
        const snoozeUntil = Date.now() + (snoozeMinutes * 60 * 1000);

        reminder.snoozedUntil = snoozeUntil;
        reminder.snoozeCount += 1;
        reminder.deliveryStatus = DeliveryStatus.SNOOZED;
        reminder.updatedAt = Date.now();

        await this.updateSmartReminder(reminder);

        // Schedule new reminder at snooze time
        await addReminder({
            eventId: reminder.eventId,
            groupId: reminder.groupId,
            userId: reminder.userId,
            summary: reminder.summary,
            start: reminder.eventStart,
            reminderAt: snoozeUntil
        });
    }

    /**
     * Reschedule a reminder
     */
    private async rescheduleReminder(reminder: SmartReminder, newTime: number): Promise<void> {
        reminder.reminderAt = newTime;
        reminder.updatedAt = Date.now();

        await this.updateSmartReminder(reminder);

        // Update in legacy reminder system
        await removeReminderByEventId(reminder.eventId);
        await addReminder({
            eventId: reminder.eventId,
            groupId: reminder.groupId,
            userId: reminder.userId,
            summary: reminder.summary,
            start: reminder.eventStart,
            reminderAt: newTime
        });
    }

    /**
     * Get event data with changes applied
     */
    private async getEventData(eventId: string, changes: any): Promise<any> {
        // This would typically fetch from Google Calendar
        // For now, return a mock structure with changes applied
        return {
            summary: changes.summary || 'Updated Event',
            start: changes.start || new Date().toISOString(),
            end: changes.end || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            location: changes.location,
            description: changes.description
        };
    }

    /**
     * Generate unique reminder ID
     */
    private generateReminderId(): string {
        return `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add reminder to user's index
     */
    private async addToReminderIndex(userId: string, reminderId: string): Promise<void> {
        try {
            const indexKey = `reminder_index_${userId}`;
            const existingData = await popPostbackPayload(indexKey);

            let reminderIds: string[] = [];
            if (existingData) {
                reminderIds = JSON.parse(existingData);
            }

            if (!reminderIds.includes(reminderId)) {
                reminderIds.push(reminderId);
            }

            await stashPostbackPayload(indexKey, JSON.stringify(reminderIds), this.REMINDER_TTL);

        } catch (error) {
            console.error('Failed to add to reminder index:', error);
        }
    }

    /**
     * Remove reminder from user's index
     */
    private async removeFromReminderIndex(userId: string, reminderId: string): Promise<void> {
        try {
            const indexKey = `reminder_index_${userId}`;
            const existingData = await popPostbackPayload(indexKey);

            if (!existingData) {
                return;
            }

            let reminderIds: string[] = JSON.parse(existingData);
            reminderIds = reminderIds.filter(id => id !== reminderId);

            await stashPostbackPayload(indexKey, JSON.stringify(reminderIds), this.REMINDER_TTL);

        } catch (error) {
            console.error('Failed to remove from reminder index:', error);
        }
    }

    /**
     * Process due smart reminders
     * This method should be called by the reminder tick system
     */
    async processDueSmartReminders(nowMs: number = Date.now()): Promise<{
        processed: number;
        sent: number;
        failed: number;
    }> {
        const stats = { processed: 0, sent: 0, failed: 0 };

        try {
            // Get all users with reminders (this is a simplified approach)
            // In a real implementation, you'd maintain a global index of active reminders
            const userIds = await this.getActiveReminderUsers();

            for (const userId of userIds) {
                const reminders = await this.getUserReminders(userId);

                for (const reminder of reminders) {
                    if (reminder.reminderAt <= nowMs &&
                        reminder.deliveryStatus === DeliveryStatus.PENDING) {

                        stats.processed++;

                        try {
                            await this.deliverSmartReminder(reminder);
                            stats.sent++;
                        } catch (error) {
                            console.error('Failed to deliver smart reminder:', error);
                            stats.failed++;

                            // Update delivery status
                            reminder.deliveryStatus = DeliveryStatus.FAILED;
                            reminder.deliveryAttempts += 1;
                            reminder.lastDeliveryAttempt = nowMs;
                            await this.updateSmartReminder(reminder);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Failed to process due smart reminders:', error);
        }

        return stats;
    }

    /**
     * Deliver a smart reminder using the notification system
     */
    private async deliverSmartReminder(reminder: SmartReminder): Promise<void> {
        const to = reminder.userId || reminder.groupId;
        if (!to) {
            throw new Error('No recipient for reminder');
        }

        try {
            // Build notification context
            const notificationContext: NotificationContext = {
                event: {
                    id: reminder.eventId,
                    summary: reminder.summary,
                    start: reminder.eventStart,
                    end: reminder.eventStart, // We don't have end time in reminder
                    location: reminder.eventContext.location?.name,
                    description: '',
                    duration: 60 // Default 1 hour
                },
                user: {
                    id: reminder.userId,
                    timezone: 'Asia/Tokyo',
                    preferences: {}
                },
                reminder: {
                    type: reminder.reminderType,
                    minutesBefore: Math.round((new Date(reminder.eventStart).getTime() - reminder.reminderAt) / (60 * 1000)),
                    priority: reminder.priority
                },
                context: reminder.eventContext,
                weather: reminder.contextAdjustment?.weatherFactor,
                traffic: reminder.contextAdjustment?.trafficFactor
            };

            // Determine template based on reminder type and context
            let templateId = 'standard_reminder';
            if (reminder.contextAdjustment?.weatherFactor && reminder.weatherDependent) {
                templateId = 'weather_reminder';
            } else if (reminder.contextAdjustment?.trafficFactor && reminder.trafficDependent) {
                templateId = 'traffic_departure';
            } else if (reminder.reminderType === ReminderType.PREPARATION) {
                templateId = 'preparation_reminder';
            } else if (reminder.reminderType === ReminderType.ESCALATION) {
                templateId = 'escalation_urgent';
            }

            // Send notification using the notification system
            const deliveryResult = await customizableNotificationSystem.sendNotification(
                templateId,
                notificationContext,
                reminder.userId
            );

            if (!deliveryResult.success) {
                throw new Error(`Notification delivery failed: ${deliveryResult.error}`);
            }

            // Update delivery status
            reminder.deliveryStatus = DeliveryStatus.SENT;
            reminder.deliveryAttempts += 1;
            reminder.lastDeliveryAttempt = Date.now();
            await this.updateSmartReminder(reminder);
        } catch (error) {
            console.error('Failed to deliver smart reminder:', error);
            throw error;
        }
    }

    /**
     * Get users with active reminders
     * This is a simplified implementation - in production you'd maintain a proper index
     */
    private async getActiveReminderUsers(): Promise<string[]> {
        // This would need to be implemented based on your user management system
        // For now, return empty array as this is called by the tick system
        return [];
    }

    /**
     * Get reminder performance metrics
     */
    async getReminderPerformanceMetrics(): Promise<{
        totalReminders: number;
        deliveryRate: number;
        averageDeliveryTime: number;
        snoozeRate: number;
        responseRate: number;
    }> {
        // This would aggregate metrics across all users
        // Implementation depends on your analytics requirements
        return {
            totalReminders: 0,
            deliveryRate: 0,
            averageDeliveryTime: 0,
            snoozeRate: 0,
            responseRate: 0
        };
    }

}

// Export singleton instance
export const smartReminderEngine = SmartReminderEngine.getInstance();

// Convenience functions
export async function scheduleSmartReminder(
    eventId: string,
    userId: string,
    eventData: {
        summary: string;
        start: string;
        end: string;
        location?: string;
        description?: string;
    },
    groupId?: string
): Promise<string[]> {
    return await smartReminderEngine.scheduleSmartReminder(eventId, userId, eventData, groupId);
}

export async function updateEventReminders(
    eventId: string,
    userId: string,
    changes: any
): Promise<void> {
    return await smartReminderEngine.updateRemindersForEvent(eventId, userId, changes);
}

export async function cancelEventReminders(eventId: string): Promise<void> {
    return await smartReminderEngine.cancelRemindersForEvent(eventId);
}

export async function processReminderResponse(
    reminderId: string,
    response: UserResponse
): Promise<void> {
    return await smartReminderEngine.processUserResponse(reminderId, response);
}

export async function getReminderStats(userId: string): Promise<any> {
    return await smartReminderEngine.getReminderStats(userId);
}

export async function processDueReminders(nowMs?: number): Promise<any> {
    return await smartReminderEngine.processDueSmartReminders(nowMs);
}

// The following APIs are not implemented on SmartReminderEngine; omit wrappers for now.

// Multi-stage reminder exports
export {
    createMultiStageReminders,
    snoozeStageReminder,
    postponeEvent,
    getSnoozeOptions,
    getEscalationStatus
} from './multi-stage-reminder';

// Notification system exports (values)
export {
    renderNotification,
    sendNotification,
    createCustomTemplate,
    configureQuietHours,
    configureDoNotDisturb,
    NotificationCategory,
    DeliveryMethod
} from './notification-system';

// Notification system exports (types)
export type {
    NotificationTemplate,
    NotificationContext,
    QuietHours,
    DoNotDisturbSettings
} from './notification-system';