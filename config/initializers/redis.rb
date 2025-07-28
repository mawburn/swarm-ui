# frozen_string_literal: true

require "redis"
require "connection_pool"

if ENV["ACTION_CABLE_ADAPTER"] == "async" && ENV["ELECTRON_APP"] == "true"
  Rails.logger.info("Running in Electron mode with async ActionCable adapter - skipping Redis initialization")
  
  $redis_pool = ConnectionPool.new(size: 1, timeout: 5) do
    # Null object pattern for Redis in Electron mode
    Class.new do
      def method_missing(method, *args, &block)
        Rails.logger.debug("Redis method called in Electron mode: #{method}")
        nil
      end
      
      def respond_to_missing?(method, include_private = false)
        true
      end
    end.new
  end
else
  redis_config = Rails.application.config_for(:redis)

  # Create a connection pool for Redis
  $redis_pool = ConnectionPool.new(size: 10, timeout: 5) do
    Redis.new(url: redis_config["url"])
  end

  begin
    $redis_pool.with do |redis|
      redis.ping
      Rails.logger.info("Redis connected successfully to #{redis_config["url"]}")
    end
  rescue => e
    Rails.logger.error("Redis connection failed: #{e.message}")
    # Only fail hard in production when not in Electron mode
    if Rails.env.production? && ENV["ELECTRON_APP"] != "true"
      raise
    end
  end
end

# Helper class for Redis operations
class RedisClient
  def self.publish(channel, message)
    $redis_pool.with do |redis|
      redis.publish(channel, message)
    end
  end

  def self.with(&block)
    $redis_pool.with(&block)
  end
end
