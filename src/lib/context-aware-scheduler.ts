// src/lib/context-aware-scheduler.ts
// Context-aware scheduling system with weather and traffic integration

import { getUserPreferences } from "./preferences-api";
import type {
  EventContext,
  LocationInfo,
  TrafficInfo,
  WeatherInfo,
} from "./smart-reminder-engine";

/**
 * Weather API response interface
 */
export interface WeatherApiResponse {
  current: {
    condition: {
      text: string;
      code: number;
    };
    temp_c: number;
    precip_mm: number;
    wind_kph: number;
  };
  forecast?: {
    forecastday: Array<{
      date: string;
      day: {
        condition: {
          text: string;
          code: number;
        };
        maxtemp_c: number;
        mintemp_c: number;
        totalprecip_mm: number;
        maxwind_kph: number;
      };
      hour: Array<{
        time: string;
        condition: {
          text: string;
        };
        temp_c: number;
        precip_mm: number;
        wind_kph: number;
      }>;
    }>;
  };
  alerts?: {
    alert: Array<{
      headline: string;
      msgtype: string;
      severity: string;
      urgency: string;
      areas: string;
      category: string;
      certainty: string;
      event: string;
      note: string;
      effective: string;
      expires: string;
      desc: string;
      instruction: string;
    }>;
  };
}

/**
 * Traffic API response interface
 */
export interface TrafficApiResponse {
  routes: Array<{
    legs: Array<{
      duration: {
        text: string;
        value: number; // seconds
      };
      duration_in_traffic?: {
        text: string;
        value: number; // seconds
      };
      distance: {
        text: string;
        value: number; // meters
      };
      start_address: string;
      end_address: string;
      steps: Array<{
        html_instructions: string;
        distance: {
          text: string;
          value: number;
        };
        duration: {
          text: string;
          value: number;
        };
      }>;
    }>;
    summary: string;
    warnings?: string[];
    waypoint_order?: number[];
  }>;
  status: string;
}

/**
 * Context adjustment result
 */
export interface ContextAdjustment {
  originalTime: number;
  adjustedTime: number;
  adjustmentMinutes: number;
  reason: string;
  confidence: number;
  weatherFactor?: WeatherInfo;
  trafficFactor?: TrafficInfo;
  recommendations: string[];
}

/**
 * Context-Aware Scheduler
 */
export class ContextAwareScheduler {
  private static instance: ContextAwareScheduler;
  private readonly WEATHER_API_KEY = process.env.WEATHER_API_KEY;
  private readonly GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private weatherCache = new Map<
    string,
    { data: WeatherInfo; timestamp: number }
  >();
  private trafficCache = new Map<
    string,
    { data: TrafficInfo; timestamp: number }
  >();

  private constructor() {}

  static getInstance(): ContextAwareScheduler {
    if (!ContextAwareScheduler.instance) {
      ContextAwareScheduler.instance = new ContextAwareScheduler();
    }
    return ContextAwareScheduler.instance;
  }

  /**
   * Calculate context-aware reminder timing
   */
  async calculateContextAwareReminder(
    eventTime: number,
    eventContext: EventContext,
    userId: string,
    baseReminderMinutes: number = 30,
  ): Promise<ContextAdjustment> {
    try {
      const originalReminderTime = eventTime - baseReminderMinutes * 60 * 1000;
      let adjustedTime = originalReminderTime;
      let adjustmentMinutes = 0;
      const recommendations: string[] = [];
      // Use undefined rather than null for absent optional factors to align with types
      let weatherFactor: WeatherInfo | undefined;
      let trafficFactor: TrafficInfo | undefined;
      let confidence = 0.8; // Base confidence

      // Get weather information if weather-dependent
      if (eventContext.location && this.isOutdoorEvent(eventContext)) {
        const wf = await this.getWeatherInfo(
          eventContext.location,
          new Date(eventTime),
        );
        if (wf) {
          weatherFactor = wf;
          const weatherAdjustment = this.calculateWeatherAdjustment(
            wf,
            eventContext,
          );
          adjustmentMinutes += weatherAdjustment.minutes;
          recommendations.push(...weatherAdjustment.recommendations);
          confidence *= weatherAdjustment.confidence;
        }
      }

      // Get traffic information if travel is required
      if (eventContext.requiresTravel && eventContext.location) {
        const userPrefs = (await getUserPreferences(userId)) as any;
        // homeLocation is not defined in DefaultValues yet; allow using first frequent location tagged 'home'
        const homeLocation: LocationInfo | undefined =
          userPrefs.defaults?.homeLocation ||
          userPrefs.defaults?.frequentLocations?.find(
            (loc: any) => loc.category === "home",
          );

        if (homeLocation) {
          const tf = await this.getTrafficInfo(
            homeLocation,
            eventContext.location,
            new Date(eventTime),
          );
          if (tf) {
            trafficFactor = tf;
            const trafficAdjustment = this.calculateTrafficAdjustment(
              tf,
              eventContext,
            );
            adjustmentMinutes += trafficAdjustment.minutes;
            recommendations.push(...trafficAdjustment.recommendations);
            confidence *= trafficAdjustment.confidence;
          }
        }
      }

      // Apply time-of-day adjustments
      const timeAdjustment = this.calculateTimeOfDayAdjustment(
        new Date(eventTime),
        eventContext,
      );
      adjustmentMinutes += timeAdjustment.minutes;
      recommendations.push(...timeAdjustment.recommendations);

      adjustedTime = originalReminderTime - adjustmentMinutes * 60 * 1000;

      // Ensure adjusted time is not in the past
      const now = Date.now();
      if (adjustedTime < now) {
        adjustedTime = now + 5 * 60 * 1000; // 5 minutes from now
        recommendations.push("リマインダー時刻を現在時刻の5分後に調整しました");
      }

      const reason = this.generateAdjustmentReason(
        adjustmentMinutes,
        weatherFactor,
        trafficFactor,
      );

      return {
        originalTime: originalReminderTime,
        adjustedTime,
        adjustmentMinutes,
        reason,
        confidence,
        weatherFactor,
        trafficFactor,
        recommendations,
      };
    } catch (error) {
      console.error("Failed to calculate context-aware reminder:", error);

      // Return original timing as fallback
      return {
        originalTime: eventTime - baseReminderMinutes * 60 * 1000,
        adjustedTime: eventTime - baseReminderMinutes * 60 * 1000,
        adjustmentMinutes: 0,
        reason: "コンテキスト情報の取得に失敗したため、標準タイミングを使用",
        confidence: 0.5,
        recommendations: ["標準のリマインダータイミングを使用しています"],
      };
    }
  }

  /**
   * Get weather information for location and time
   */
  async getWeatherInfo(
    location: LocationInfo,
    eventTime: Date,
  ): Promise<WeatherInfo | undefined> {
    try {
      if (!this.WEATHER_API_KEY) {
        console.warn("Weather API key not configured");
        return undefined;
      }

      const cacheKey = `${location.name}_${eventTime.toDateString()}`;
      const cached = this.weatherCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      // Use WeatherAPI.com (free tier available)
      const query = location.coordinates
        ? `${location.coordinates.latitude},${location.coordinates.longitude}`
        : location.name;

      const url = `https://api.weatherapi.com/v1/forecast.json?key=${this.WEATHER_API_KEY}&q=${encodeURIComponent(query)}&days=3&aqi=no&alerts=yes`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data: WeatherApiResponse = await response.json();

      // Find the forecast for the event time
      const eventDate = eventTime.toISOString().split("T")[0];
      const eventHour = eventTime.getHours();

      let weatherInfo: WeatherInfo;

      if (data.forecast) {
        const dayForecast = data.forecast.forecastday.find(
          (day) => day.date === eventDate,
        );

        if (dayForecast) {
          const hourForecast = dayForecast.hour.find((hour) => {
            const hourTime = new Date(hour.time).getHours();
            return hourTime === eventHour;
          });

          weatherInfo = {
            condition:
              hourForecast?.condition.text || dayForecast.day.condition.text,
            temperature:
              hourForecast?.temp_c ||
              (dayForecast.day.maxtemp_c + dayForecast.day.mintemp_c) / 2,
            precipitation:
              hourForecast?.precip_mm || dayForecast.day.totalprecip_mm,
            windSpeed: hourForecast?.wind_kph || dayForecast.day.maxwind_kph,
            alerts: data.alerts?.alert.map((alert) => alert.headline) || [],
            recommendation: this.generateWeatherRecommendation(
              hourForecast?.condition.text || dayForecast.day.condition.text,
              hourForecast?.temp_c ||
                (dayForecast.day.maxtemp_c + dayForecast.day.mintemp_c) / 2,
              hourForecast?.precip_mm || dayForecast.day.totalprecip_mm,
            ),
          };
        } else {
          // Use current weather as fallback
          weatherInfo = {
            condition: data.current.condition.text,
            temperature: data.current.temp_c,
            precipitation: data.current.precip_mm,
            windSpeed: data.current.wind_kph,
            alerts: data.alerts?.alert.map((alert) => alert.headline) || [],
            recommendation: this.generateWeatherRecommendation(
              data.current.condition.text,
              data.current.temp_c,
              data.current.precip_mm,
            ),
          };
        }
      } else {
        weatherInfo = {
          condition: data.current.condition.text,
          temperature: data.current.temp_c,
          precipitation: data.current.precip_mm,
          windSpeed: data.current.wind_kph,
          alerts: data.alerts?.alert.map((alert) => alert.headline) || [],
          recommendation: this.generateWeatherRecommendation(
            data.current.condition.text,
            data.current.temp_c,
            data.current.precip_mm,
          ),
        };
      }

      // Cache the result
      this.weatherCache.set(cacheKey, {
        data: weatherInfo,
        timestamp: Date.now(),
      });

      return weatherInfo;
    } catch (error) {
      console.error("Failed to get weather info:", error);
      return undefined;
    }
  }

  /**
   * Get traffic information between locations
   */
  async getTrafficInfo(
    origin: LocationInfo,
    destination: LocationInfo,
    eventTime: Date,
  ): Promise<TrafficInfo | undefined> {
    try {
      if (!this.GOOGLE_MAPS_API_KEY) {
        console.warn("Google Maps API key not configured");
        return undefined;
      }

      const cacheKey = `${origin.name}_${destination.name}_${eventTime.getHours()}`;
      const cached = this.trafficCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }

      const originQuery = origin.coordinates
        ? `${origin.coordinates.latitude},${origin.coordinates.longitude}`
        : origin.name;

      const destinationQuery = destination.coordinates
        ? `${destination.coordinates.latitude},${destination.coordinates.longitude}`
        : destination.name;

      // Use departure time for traffic calculation
      const departureTime = Math.floor(eventTime.getTime() / 1000);

      const url =
        `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${encodeURIComponent(originQuery)}&` +
        `destination=${encodeURIComponent(destinationQuery)}&` +
        `departure_time=${departureTime}&` +
        `traffic_model=best_guess&` +
        `key=${this.GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Traffic API error: ${response.status}`);
      }

      const data: TrafficApiResponse = await response.json();

      if (data.status !== "OK" || !data.routes.length) {
        throw new Error(`Traffic API returned status: ${data.status}`);
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      const trafficInfo: TrafficInfo = {
        duration: Math.round(leg.duration.value / 60), // Convert to minutes
        durationInTraffic: leg.duration_in_traffic
          ? Math.round(leg.duration_in_traffic.value / 60)
          : Math.round(leg.duration.value / 60),
        distance: Math.round(leg.distance.value / 1000), // Convert to km
        route: route.summary,
        alerts: route.warnings || [],
        recommendation: this.generateTrafficRecommendation(
          leg.duration.value,
          leg.duration_in_traffic?.value || leg.duration.value,
        ),
      };

      // Cache the result
      this.trafficCache.set(cacheKey, {
        data: trafficInfo,
        timestamp: Date.now(),
      });

      return trafficInfo;
    } catch (error) {
      console.error("Failed to get traffic info:", error);
      return undefined;
    }
  }

  /**
   * Check if event is outdoor/weather-dependent
   */
  private isOutdoorEvent(eventContext: EventContext): boolean {
    if (!eventContext.location) return false;

    const location = eventContext.location.name.toLowerCase();
    const eventType = eventContext.eventType?.toLowerCase() || "";

    // Indoor locations
    const indoorKeywords = [
      "オンライン",
      "zoom",
      "teams",
      "skype",
      "会議室",
      "オフィス",
      "室内",
      "屋内",
      "ホール",
      "センター",
      "ビル",
      "館",
    ];

    // Outdoor event types
    const outdoorKeywords = [
      "屋外",
      "公園",
      "パーク",
      "スポーツ",
      "ゴルフ",
      "テニス",
      "ランニング",
      "ウォーキング",
      "ハイキング",
      "バーベキュー",
      "ピクニック",
      "フェス",
      "祭り",
    ];

    const hasIndoorKeyword = indoorKeywords.some(
      (keyword) => location.includes(keyword) || eventType.includes(keyword),
    );

    const hasOutdoorKeyword = outdoorKeywords.some(
      (keyword) => location.includes(keyword) || eventType.includes(keyword),
    );

    return (
      hasOutdoorKeyword ||
      (!hasIndoorKeyword && eventContext.eventType !== "meeting")
    );
  }

  /**
   * Calculate weather-based adjustment
   */
  private calculateWeatherAdjustment(
    weather: WeatherInfo,
    eventContext: EventContext,
  ): { minutes: number; recommendations: string[]; confidence: number } {
    let adjustmentMinutes = 0;
    const recommendations: string[] = [];
    let confidence = 0.9;

    // Temperature considerations
    if (weather.temperature < 5) {
      adjustmentMinutes += 10;
      recommendations.push(
        "気温が低いため、防寒対策の時間を考慮して早めにリマインドします",
      );
    } else if (weather.temperature > 30) {
      adjustmentMinutes += 5;
      recommendations.push("気温が高いため、暑さ対策の準備時間を追加しました");
    }

    // Precipitation considerations
    if (weather.precipitation > 0.5) {
      adjustmentMinutes += 15;
      recommendations.push(
        "雨の予報があるため、雨具の準備と移動時間を考慮しました",
      );

      if (weather.precipitation > 5) {
        adjustmentMinutes += 10;
        recommendations.push(
          "強い雨の予報のため、さらに余裕を持った時間設定にしました",
        );
      }
    }

    // Wind considerations
    if (weather.windSpeed > 20) {
      adjustmentMinutes += 5;
      recommendations.push("強風の予報があるため、移動に注意が必要です");
    }

    // Weather alerts
    if (weather.alerts && weather.alerts.length > 0) {
      adjustmentMinutes += 20;
      recommendations.push(
        `気象警報が発令されています: ${weather.alerts.join(", ")}`,
      );
      confidence = 0.7; // Lower confidence due to uncertainty
    }

    // Weather recommendation
    if (weather.recommendation) {
      recommendations.push(weather.recommendation);
    }

    return { minutes: adjustmentMinutes, recommendations, confidence };
  }

  /**
   * Calculate traffic-based adjustment
   */
  private calculateTrafficAdjustment(
    traffic: TrafficInfo,
    eventContext: EventContext,
  ): { minutes: number; recommendations: string[]; confidence: number } {
    let adjustmentMinutes = 0;
    const recommendations: string[] = [];
    let confidence = 0.8;

    // Traffic delay consideration
    const trafficDelay = traffic.durationInTraffic - traffic.duration;

    if (trafficDelay > 5) {
      // Add buffer time based on traffic delay
      adjustmentMinutes += Math.min(trafficDelay, 30); // Cap at 30 minutes
      recommendations.push(
        `交通渋滞により通常より${trafficDelay}分多くかかる予想です。余裕を持って出発してください。`,
      );

      if (trafficDelay > 15) {
        confidence = 0.6; // Lower confidence for high traffic delays
      }
    }

    // Route warnings
    if (traffic.alerts && traffic.alerts.length > 0) {
      adjustmentMinutes += 10;
      recommendations.push(`交通情報: ${traffic.alerts.join(", ")}`);
    }

    // Traffic recommendation
    if (traffic.recommendation) {
      recommendations.push(traffic.recommendation);
    }

    return { minutes: adjustmentMinutes, recommendations, confidence };
  }

  /**
   * Calculate time-of-day adjustment
   */
  private calculateTimeOfDayAdjustment(
    eventTime: Date,
    eventContext: EventContext,
  ): { minutes: number; recommendations: string[] } {
    let adjustmentMinutes = 0;
    const recommendations: string[] = [];
    const hour = eventTime.getHours();

    // Rush hour considerations
    if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
      if (eventContext.requiresTravel) {
        adjustmentMinutes += 15;
        recommendations.push(
          "ラッシュアワーのため、移動時間に余裕を持たせました",
        );
      }
    }

    // Early morning events
    if (hour < 8) {
      adjustmentMinutes += 10;
      recommendations.push("早朝の予定のため、準備時間を多めに確保しました");
    }

    // Late evening events
    if (hour >= 20) {
      adjustmentMinutes += 5;
      recommendations.push("夜間の予定です。帰宅手段の確認をお忘れなく");
    }

    return { minutes: adjustmentMinutes, recommendations };
  }

  /**
   * Generate weather recommendation
   */
  private generateWeatherRecommendation(
    condition: string,
    temperature: number,
    precipitation: number,
  ): string {
    const recommendations: string[] = [];

    if (precipitation > 0.5) {
      recommendations.push("雨具をお持ちください");
    }

    if (temperature < 10) {
      recommendations.push("防寒対策をお忘れなく");
    } else if (temperature > 25) {
      recommendations.push("暑さ対策をお忘れなく");
    }

    if (condition.toLowerCase().includes("snow")) {
      recommendations.push("雪の予報です。滑りにくい靴でお出かけください");
    }

    return recommendations.length > 0
      ? recommendations.join("。") + "。"
      : "天気に問題はありません。";
  }

  /**
   * Generate traffic recommendation
   */
  private generateTrafficRecommendation(
    normalDuration: number,
    trafficDuration: number,
  ): string {
    const delay = Math.round((trafficDuration - normalDuration) / 60); // Convert to minutes

    if (delay <= 5) {
      return "交通状況は良好です。";
    } else if (delay <= 15) {
      return `通常より${delay}分程度多くかかる見込みです。`;
    } else {
      return `交通渋滞により${delay}分以上の遅延が予想されます。代替ルートの検討をお勧めします。`;
    }
  }

  /**
   * Generate adjustment reason
   */
  private generateAdjustmentReason(
    adjustmentMinutes: number,
    weather?: WeatherInfo,
    traffic?: TrafficInfo,
  ): string {
    if (adjustmentMinutes === 0) {
      return "標準のリマインダータイミングを使用";
    }

    const factors: string[] = [];

    if (weather) {
      if (weather.precipitation > 0.5) factors.push("雨の予報");
      if (weather.temperature < 5) factors.push("低温");
      if (weather.temperature > 30) factors.push("高温");
      if (weather.alerts && weather.alerts.length > 0) factors.push("気象警報");
    }

    if (traffic) {
      const delay = traffic.durationInTraffic - traffic.duration;
      if (delay > 5) factors.push("交通渋滞");
      if (traffic.alerts && traffic.alerts.length > 0) factors.push("交通情報");
    }

    if (factors.length === 0) {
      return `時間帯を考慮して${adjustmentMinutes}分早めに設定`;
    }

    return `${factors.join("、")}を考慮して${adjustmentMinutes}分早めに設定`;
  }

  /**
   * Clear caches (for testing or maintenance)
   */
  clearCaches(): void {
    this.weatherCache.clear();
    this.trafficCache.clear();
  }
}

// Export singleton instance
export const contextAwareScheduler = ContextAwareScheduler.getInstance();

// Convenience functions
export async function calculateContextAwareReminder(
  eventTime: number,
  eventContext: EventContext,
  userId: string,
  baseReminderMinutes?: number,
): Promise<ContextAdjustment> {
  return await contextAwareScheduler.calculateContextAwareReminder(
    eventTime,
    eventContext,
    userId,
    baseReminderMinutes,
  );
}

export async function getWeatherForEvent(
  location: LocationInfo,
  eventTime: Date,
): Promise<WeatherInfo | undefined> {
  return await contextAwareScheduler.getWeatherInfo(location, eventTime);
}

export async function getTrafficForEvent(
  origin: LocationInfo,
  destination: LocationInfo,
  eventTime: Date,
): Promise<TrafficInfo | undefined> {
  return await contextAwareScheduler.getTrafficInfo(
    origin,
    destination,
    eventTime,
  );
}
