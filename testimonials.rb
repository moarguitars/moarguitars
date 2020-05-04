require 'json'
require 'httparty'
require 'dotenv'

class Testimonials
	include HTTParty
	base_uri "https://api.airtable.com/v0/applsyooY4qYpq1no"

	def testimonials
		self.class.get('/Testimonials?view=Grid%20view&api_key=keykx6o2ysAy0m8xs')
	end
end

testimonials = Testimonials.new

# Change the filename here below but make sure it's in the _data folder.
File.open("/Users/johnhaynes/documents/Github/moarguitars/_data/testimonials.json", "wb") do |f|
    data = testimonials.testimonials
    f.write(data)
end