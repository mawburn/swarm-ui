# frozen_string_literal: true

require "open3"

class BackgroundSessionService
  class << self
    def find_or_create_session(project:, issue_number: nil, pr_number: nil, issue_type: nil, initial_prompt:, user_login: nil, issue_title: nil, start_background: true)
      # Try to find existing session for this issue/PR (if GitHub-related)
      session = if issue_number || pr_number
        find_existing_github_session(project, issue_number, pr_number)
      end

      if session
        Rails.logger.info("Found existing session #{session.id} for #{issue_type} ##{issue_number || pr_number}")
      else
        Rails.logger.info("Creating new session#{issue_type ? " for #{issue_type} ##{issue_number || pr_number}" : ""}")
        session = create_session(
          project: project,
          issue_number: issue_number,
          pr_number: pr_number,
          issue_type: issue_type,
          initial_prompt: initial_prompt,
          user_login: user_login,
          issue_title: issue_title,
        )

        # Start the session in background if requested
        if start_background && session.persisted?
          start_session_background(session)
        end

      end
      session
    end

    def send_comment_to_session(session, text, user_login: nil)
      return unless session.active?

      tmux_session_name = "swarm-ui-#{session.session_id}"

      # Format the message with context
      formatted_text = format_comment(text, user_login)

      # Send to tmux session
      _, stderr, status = Open3.capture3("tmux", "send-keys", "-t", tmux_session_name, "-l", formatted_text)

      if status.success?
        # Send Enter key
        Open3.capture3("tmux", "send-keys", "-t", tmux_session_name, "Enter")
        Rails.logger.info("Sent comment to session #{session.id}: #{text}")
        true
      else
        Rails.logger.error("Failed to send comment to tmux: #{stderr}")
        false
      end
    rescue => e
      Rails.logger.error("Error sending comment to session: #{e.message}")
      false
    end

    def restart_session(session, new_prompt, user_login: nil)
      if session.stopped?
        Rails.logger.info("Restarting stopped session #{session.id}")
        session.update!(
          status: "active",
          resumed_at: Time.current,
          initial_prompt: new_prompt, # Update the prompt for restart
        )

        # Start the session in background
        start_session_background(session)

        # Give it a moment to start before sending the comment
        sleep(1)
      end

      # Send the prompt to the session
      send_comment_to_session(session, new_prompt, user_login: user_login)
    end

    def find_existing_github_session(project, issue_number, pr_number)
      scope = project.sessions

      if pr_number
        scope = scope.where(github_pr_number: pr_number)
      elsif issue_number
        scope = scope.where(github_issue_number: issue_number)
      else
        return
      end

      # Get the most recent session (active or stopped)
      scope.where(status: ["active", "stopped"]).order(created_at: :desc).first
    end

    private

    def create_session(project:, issue_number: nil, pr_number: nil, issue_type: nil, initial_prompt:, user_login: nil, issue_title: nil, session_name: nil)
      # Generate session name if not provided
      session_name ||= if issue_number || pr_number
        generate_github_session_name(project, issue_number, pr_number, issue_type, issue_title)
      else
        "#{project.name} - #{Time.current.strftime("%Y-%m-%d %H:%M")}"
      end

      # Build full prompt with context if GitHub-related
      full_prompt = if issue_number || pr_number
        build_github_context_prompt(project, issue_number, pr_number, issue_type, initial_prompt, user_login)
      else
        initial_prompt
      end

      Session.create!(
        project: project,
        swarm_name: session_name,
        github_issue_number: issue_number,
        github_pr_number: pr_number,
        github_issue_type: issue_type,
        initial_prompt: full_prompt,
        configuration_path: project.default_config_path,
        use_worktree: project.default_use_worktree,
        environment_variables: project.environment_variables,
        session_id: SecureRandom.uuid,
        status: "active",
        started_at: Time.current,
      )
    end

    def generate_github_session_name(project, issue_number, pr_number, issue_type, issue_title)
      # Truncate title if too long
      title_part = if issue_title.present?
        truncated_title = issue_title.length > 30 ? "#{issue_title[0..27]}..." : issue_title
        ": #{truncated_title}"
      else
        ""
      end

      if pr_number
        "#{project.name} - PR ##{pr_number}#{title_part}"
      elsif issue_number
        "#{project.name} - Issue ##{issue_number}#{title_part}"
      else
        "#{project.name} - GitHub #{issue_type.humanize}"
      end
    end

    def build_github_context_prompt(project, issue_number, pr_number, issue_type, user_prompt, user_login)
      parts = []

      # Add context about what we're working on
      if pr_number
        parts << "You are assisting with Pull Request ##{pr_number} in the #{project.name} project."
      elsif issue_number
        parts << "You are assisting with Issue ##{issue_number} in the #{project.name} project."
      end

      # Add repository context
      if project.github_configured?
        parts << "Repository: #{project.github_repo_full_name}"
      end

      # Add user context
      if user_login
        parts << "Request from GitHub user: @#{user_login}"
      end

      # Add the actual user prompt
      parts << "\n#{user_prompt}"

      parts.join("\n")
    end

    def format_comment(text, user_login)
      timestamp = Time.current.strftime("%H:%M:%S")
      user_info = user_login ? " from @#{user_login}" : ""
      "\n[GitHub Comment#{user_info} at #{timestamp}]: #{text}\n"
    end

    def start_session_background(session)
      Rails.logger.info("Starting session #{session.id} in background")

      # Get the terminal URL to extract encoded payload
      terminal_url = session.terminal_url(new_session: true)

      # Extract the encoded payload from the URL
      query_string = terminal_url.split("?").last
      chunks = query_string.split("&").map { |param| param.split("=").last }
      encoded_payload = chunks.join("")

      Rails.logger.info("Executing ttyd-bg for session #{session.id}")

      # Execute ttyd-bg script with the encoded payload
      system("bin/ttyd-bg", encoded_payload)

      Rails.logger.info("Background session started for session #{session.id}")

      # Give it a moment to start
      sleep(0.5)

      true
    rescue => e
      Rails.logger.error("Failed to start background session: #{e.message}")
      Rails.logger.error(e.backtrace.join("\n"))
      false
    end
  end
end
