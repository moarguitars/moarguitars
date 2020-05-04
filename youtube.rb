require 'json'
require 'httparty'
require 'dotenv'

class YouTube
	include HTTParty
	base_uri "https://api.airtable.com/v0/applsyooY4qYpq1no"

	def youtube
		self.class.get('/YouTube?view=Grid%20view&api_key=keykx6o2ysAy0m8xs')
	end
end

youtube = YouTube.new

# Change the filename here below but make sure it's in the _data folder.
File.open("/Users/johnhaynes/documents/Github/moarguitars/_data/youtube.json", "wb") do |f|
    data = youtube.youtube
    f.write(data)
end