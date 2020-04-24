# Plugin to add environment variables to the `site` object in Liquid templates
require 'dotenv'

module Jekyll
  class EnvironmentVariablesGenerator < Generator
    priority :highest
    
    def generate(site)
      Dotenv.overload
      site.config['env'] = Dotenv.overload

      site.config['SYNC_WITH_AIRTABLE'] = ENV['SYNC_WITH_AIRTABLE']
      site.config['AIRTABLE_API_KEY']   = ENV['AIRTABLE_API_KEY']
      site.config['AIRTABLE_BASE_UID']  = ENV['AIRTABLE_BASE_UID']
      site.config['AIRTABLE_TABLE_NAMES'] = ENV['AIRTABLE_TABLE_NAMES'].split(',').map(&:strip)
    end
  end
end