// src/lib/__tests__/context-aware-scheduler.test.ts
// Unit tests for Context-Aware Scheduler

import { ContextAwareScheduler } from "../context-aware-scheduler";
import type { EventContext, LocationInfo } from "../smart-reminder-engine";

// Mock fetch for API calls
global.fetch = jest.fn();

describe("ContextAwareScheduler", () => {
  let scheduler: ContextAwareScheduler;
  const mockUserId = "user123";

  const mockEventContext: EventContext = {
    location: {
      name: "Central Park",
      coordinates: {
        latitude: 40.785091,
        longitude: -73.968285,
      },
      travelTimeMinutes: 30,
    },
    eventType: "outdoor",
    importance: "normal",
    requiresTravel: true,
    hasPreparation: false,
  };

  const mockWeatherResponse = {
    current: {
      condition: {
        text: "Partly cloudy",
        code: 1003,
      },
      temp_c: 22,
      precip_mm: 0,
      wind_kph: 10,
    },
    forecast: {
      forecastday: [
        {
          date: "2024-01-15",
          day: {
            condition: {
              text: "Sunny",
              code: 1000,
            },
            maxtemp_c: 25,
            mintemp_c: 15,
            totalprecip_mm: 0,
            maxwind_kph: 15,
          },
          hour: [
            {
              time: "2024-01-15 14:00",
              condition: {
                text: "Sunny",
              },
              temp_c: 24,
              precip_mm: 0,
              wind_kph: 12,
            },
          ],
        },
      ],
    },
  };

  const mockTrafficResponse = {
    routes: [
      {
        legs: [
          {
            duration: {
              text: "25 mins",
              value: 1500, // 25 minutes in seconds
            },
            duration_in_traffic: {
              text: "35 mins",
              value: 2100, // 35 minutes in seconds
            },
            distance: {
              text: "15.2 km",
              value: 15200,
            },
            start_address: "Home",
            end_address: "Central Park",
          },
        ],
        summary: "Via Main Street",
        warnings: ["Heavy traffic expected"],
      },
    ],
    status: "OK",
  };

  beforeEach(() => {
    scheduler = ContextAwareScheduler.getInstance();
    // Reset all mocks including implementations to avoid leakage across tests
    jest.resetAllMocks();
    scheduler.clearCaches();

    // Mock getUserPreferences
    jest.doMock("../preferences-api", () => ({
      getUserPreferences: jest.fn().mockResolvedValue({
        defaults: {
          homeLocation: {
            name: "Home",
            coordinates: {
              latitude: 40.7589,
              longitude: -73.9851,
            },
          },
        },
      }),
    }));
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = ContextAwareScheduler.getInstance();
      const instance2 = ContextAwareScheduler.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("calculateContextAwareReminder", () => {
    it("should calculate basic reminder timing without external factors", async () => {
      const eventTime = Date.now() + 2 * 60 * 60 * 1000; // 2 hours from now
      const simpleContext: EventContext = {
        eventType: "meeting",
        importance: "normal",
      };

      const result = await scheduler.calculateContextAwareReminder(
        eventTime,
        simpleContext,
        mockUserId,
        30,
      );

      expect(result).toHaveProperty("originalTime");
      expect(result).toHaveProperty("adjustedTime");
      expect(result).toHaveProperty("adjustmentMinutes");
      expect(result).toHaveProperty("reason");
      expect(result).toHaveProperty("confidence");
      expect(result).toHaveProperty("recommendations");
    });

    it("should adjust timing for weather conditions", async () => {
      // Mock weather API response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockWeatherResponse,
            current: {
              ...mockWeatherResponse.current,
              precip_mm: 5, // Rain
              temp_c: 2, // Cold
            },
          }),
      });

      const eventTime = Date.now() + 2 * 60 * 60 * 1000;
      const outdoorContext: EventContext = {
        ...mockEventContext,
        eventType: "outdoor",
      };

      const result = await scheduler.calculateContextAwareReminder(
        eventTime,
        outdoorContext,
        mockUserId,
        30,
      );

      expect(result.adjustmentMinutes).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.weatherFactor).toBeDefined();
    });

    it("should adjust timing for traffic conditions", async () => {
      // Mock traffic API response
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTrafficResponse),
      });

      const eventTime = Date.now() + 2 * 60 * 60 * 1000;

      const result = await scheduler.calculateContextAwareReminder(
        eventTime,
        mockEventContext,
        mockUserId,
        30,
      );

      expect(result.adjustmentMinutes).toBeGreaterThan(0);
      expect(result.trafficFactor).toBeDefined();
      expect(result.recommendations.some((rec) => rec.includes("交通"))).toBe(
        true,
      );
    });

    it("should handle API failures gracefully", async () => {
      // Mock API failure
      (fetch as jest.Mock).mockRejectedValue(new Error("API Error"));

      const eventTime = Date.now() + 2 * 60 * 60 * 1000;

      const result = await scheduler.calculateContextAwareReminder(
        eventTime,
        mockEventContext,
        mockUserId,
        30,
      );

      expect(result.adjustmentMinutes).toBe(0);
      expect(result.confidence).toBe(0.5);
      expect(result.reason).toContain("標準タイミング");
    });

    it("should adjust for time of day (rush hour)", async () => {
      // Create event time during rush hour (8 AM)
      const rushHourTime = new Date();
      rushHourTime.setHours(8, 0, 0, 0);
      rushHourTime.setDate(rushHourTime.getDate() + 1); // Tomorrow

      const result = await scheduler.calculateContextAwareReminder(
        rushHourTime.getTime(),
        mockEventContext,
        mockUserId,
        30,
      );

      expect(result.adjustmentMinutes).toBeGreaterThan(0);
      expect(
        result.recommendations.some((rec) => rec.includes("ラッシュ")),
      ).toBe(true);
    });

    it("should not adjust past current time", async () => {
      const eventTime = Date.now() + 10 * 60 * 1000; // 10 minutes from now

      const result = await scheduler.calculateContextAwareReminder(
        eventTime,
        mockEventContext,
        mockUserId,
        30, // 30 minutes before - would be in the past
      );

      expect(result.adjustedTime).toBeGreaterThan(Date.now());
      expect(
        result.recommendations.some((rec) => rec.includes("現在時刻")),
      ).toBe(true);
    });
  });

  describe("getWeatherInfo", () => {
    it("should fetch and parse weather information", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWeatherResponse),
      });

      const location: LocationInfo = {
        name: "Central Park",
        coordinates: {
          latitude: 40.785091,
          longitude: -73.968285,
        },
      };

      const eventTime = new Date("2024-01-15T14:00:00Z");
      const weather = await scheduler.getWeatherInfo(location, eventTime);

      expect(weather).toBeDefined();
      expect(weather?.condition).toBe("Sunny");
      expect(weather?.temperature).toBe(24);
      expect(weather?.precipitation).toBe(0);
    });

    it("should use cached weather data", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockWeatherResponse),
      });

      const location: LocationInfo = { name: "Central Park" };
      const eventTime = new Date();

      // First call
      await scheduler.getWeatherInfo(location, eventTime);

      // Second call should use cache
      await scheduler.getWeatherInfo(location, eventTime);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should handle weather API errors", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const location: LocationInfo = { name: "Invalid Location" };
      const eventTime = new Date();

      const weather = await scheduler.getWeatherInfo(location, eventTime);

      expect(weather).toBeNull();
    });

    it("should return null when API key is not configured", async () => {
      // Temporarily remove API key
      const originalKey = process.env.WEATHER_API_KEY;
      delete process.env.WEATHER_API_KEY;

      const location: LocationInfo = { name: "Central Park" };
      const eventTime = new Date();

      const weather = await scheduler.getWeatherInfo(location, eventTime);

      expect(weather).toBeNull();

      // Restore API key
      if (originalKey) {
        process.env.WEATHER_API_KEY = originalKey;
      }
    });
  });

  describe("getTrafficInfo", () => {
    it("should fetch and parse traffic information", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTrafficResponse),
      });

      const origin: LocationInfo = { name: "Home" };
      const destination: LocationInfo = { name: "Central Park" };
      const eventTime = new Date();

      const traffic = await scheduler.getTrafficInfo(
        origin,
        destination,
        eventTime,
      );

      expect(traffic).toBeDefined();
      expect(traffic?.duration).toBe(25); // 25 minutes
      expect(traffic?.durationInTraffic).toBe(35); // 35 minutes
      expect(traffic?.distance).toBe(15); // 15 km
    });

    it("should use cached traffic data", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTrafficResponse),
      });

      const origin: LocationInfo = { name: "Home" };
      const destination: LocationInfo = { name: "Central Park" };
      const eventTime = new Date();
      eventTime.setHours(14); // Same hour for caching

      // First call
      await scheduler.getTrafficInfo(origin, destination, eventTime);

      // Second call should use cache
      await scheduler.getTrafficInfo(origin, destination, eventTime);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should handle traffic API errors", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      const origin: LocationInfo = { name: "Invalid" };
      const destination: LocationInfo = { name: "Location" };
      const eventTime = new Date();

      const traffic = await scheduler.getTrafficInfo(
        origin,
        destination,
        eventTime,
      );

      expect(traffic).toBeNull();
    });

    it("should return null when API key is not configured", async () => {
      // Temporarily remove API key
      const originalKey = process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_MAPS_API_KEY;

      const origin: LocationInfo = { name: "Home" };
      const destination: LocationInfo = { name: "Central Park" };
      const eventTime = new Date();

      const traffic = await scheduler.getTrafficInfo(
        origin,
        destination,
        eventTime,
      );

      expect(traffic).toBeNull();

      // Restore API key
      if (originalKey) {
        process.env.GOOGLE_MAPS_API_KEY = originalKey;
      }
    });
  });

  describe("clearCaches", () => {
    it("should clear weather and traffic caches", async () => {
      // Add some data to cache first
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockWeatherResponse),
      });

      const location: LocationInfo = { name: "Test Location" };
      const eventTime = new Date();

      await scheduler.getWeatherInfo(location, eventTime);

      // Clear caches
      scheduler.clearCaches();

      // Next call should fetch again
      await scheduler.getWeatherInfo(location, eventTime);

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });
});
