require 'json'
require 'httparty'
require 'dotenv'

class Gallery
	include HTTParty
	base_uri "https://api.airtable.com/v0/applsyooY4qYpq1no"

	def gallery
		self.class.get('/gallery?view=Grid%20view&api_key=keykx6o2ysAy0m8xs')
	end
end

gallery = Gallery.new

# Change the filename here below but make sure it's in the _data folder.
File.open("/Users/johnhaynes/documents/Github/moarguitars/_data/gallery.json", "wb") do |f|
    data = gallery.gallery
    f.write(data)
end