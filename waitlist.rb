require 'json'
require 'httparty'
require 'dotenv'

class WaitList
	include HTTParty
	base_uri "https://api.airtable.com/v0/appQjVXW2zEsNMZdB"

	def customers
		self.class.get('/waitlist?view=Grid%20view&api_key=keykx6o2ysAy0m8xs')
	end
end

waitlist = WaitList.new

# Change the filename here below but make sure it's in the _data folder.
File.open("/Users/johnhaynes/documents/Github/moarguitars/_data/customers.json", "wb") do |f|
    data = waitlist.customers
    f.write(data)
end