require 'json'
require 'httparty'
require 'dotenv'

class Insta
	include HTTParty
	base_uri "https://api.airtable.com/v0/applsyooY4qYpq1no"

	def instagram
		self.class.get('/instagram?view=Grid%20view&api_key=keykx6o2ysAy0m8xs')
	end
end

instagram = Insta.new

# Change the filename here below but make sure it's in the _data folder.
File.open("/Users/johnhaynes/documents/Github/moarguitars/_data/instagram.json", "wb") do |f|
    data = instagram.instagram
    f.write(data)
end