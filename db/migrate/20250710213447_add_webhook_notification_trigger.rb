# frozen_string_literal: true

class AddWebhookNotificationTrigger < ActiveRecord::Migration[8.0]
  def up
    # Skip for SQLite - triggers are PostgreSQL-specific
    return if ActiveRecord::Base.connection.adapter_name == "SQLite"
    
    execute(<<-SQL)
      CREATE OR REPLACE FUNCTION notify_webhook_change() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
          PERFORM pg_notify(
            'webhook_changes',
            json_build_object(
              'project_id', NEW.id,
              'enabled', NEW.github_webhook_enabled,
              'operation', TG_OP
            )::text
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER webhook_change_trigger
      AFTER INSERT OR UPDATE OF github_webhook_enabled
      ON projects
      FOR EACH ROW
      EXECUTE FUNCTION notify_webhook_change();
    SQL
  end

  def down
    # Skip for SQLite - triggers are PostgreSQL-specific
    return if ActiveRecord::Base.connection.adapter_name == "SQLite"
    
    execute(<<-SQL)
      DROP TRIGGER IF EXISTS webhook_change_trigger ON projects;
      DROP FUNCTION IF EXISTS notify_webhook_change();
    SQL
  end
end
