# frozen_string_literal: true

class GithubCliService
  class << self
    def available?
      @available ||= check_gh_cli_availability
    end

    def webhook_extension_installed?
      return false unless available?

      @webhook_installed ||= check_webhook_extension
    end

    def ensure_dependencies!
      unless available?
        raise "GitHub CLI (gh) is not installed. Please install it to use GitHub webhook features."
      end

      unless webhook_extension_installed?
        Rails.logger.warn("GitHub CLI webhook extension not installed. Installing...")
        install_webhook_extension
      end
    end

    private

    def check_gh_cli_availability
      system("gh", "--version", out: File::NULL, err: File::NULL)
    rescue StandardError
      false
    end

    def check_webhook_extension
      output = %x(gh extension list 2>/dev/null)
      output.include?("cli/gh-webhook")
    rescue StandardError
      false
    end

    def install_webhook_extension
      system("gh", "extension", "install", "cli/gh-webhook")
    rescue StandardError => e
      Rails.logger.error("Failed to install gh webhook extension: #{e.message}")
      false
    end
  end
end
