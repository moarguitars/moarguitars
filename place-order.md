---
layout: page
title: Place Order Request
show_tile: false
nav-menu: false
---

<!-- Main -->
<div id="main" class="alt">

<!-- Intro -->
<section>
	<div class="inner">
		<section style="margin-top: 6em" >
			<h2>Place Order</h2>
			<!-- Success! -->
			<div id="showme" style="display:none;" class="box order-success">
				<div class="loader" id="loader"></div>
				<div id="order-success-message" class="order-success-message">
					<h3>Order Placed - Deposit Required</h3>
					<p>Your order request has been placed and I will be in touch soon about the details of your build.</p>
					<p>A deposit is required before your name can be added to our waitlist.</p>
					<ul class="actions">
						<li><input type="button" value="Pay Deposit Now" class="special" onclick="window.location.assign('/checkout/' + guitarmodel.value,'newtab')"/></li>
					</ul>
				</div>
			</div>
			<p>So you’ve gone through my site and have come to the excellent decision that you want to order a guitar. First off thanks! That’s brilliant news, welcome to the family! To commit you and I to the build, and to get onto my waiting list - <strong>once you place this request, you will be asked to pay for your deposit via PayPal</strong>. The waiting list is currently about 4 months from me receiving the deposit to you receiving your guitar.</p> 
			<p>I am also still very much a custom shop, and love taking on one of a kind, custom orders. Want a hollow flying V, a fretless baritone RD, a headless, midi connected bass, I am fresh! Just <a href="{{ 'contact' | relative_url }}">send me a mail</a> and we can chat.</p>
			<!-- Form -->
			<form id="order-request" method="post" action="https://formspree.io/xdowqbno">
				<div class="field">
					<label for="customer">Email</label>
					<input type="email" id="email" placeholder="team@moarguitars.com" name="email" required/>
				</div>
				<div class="field">
					<label for="name">Your Name</label>
					<input type="text" id="yourname" placeholder="Morty Moar" name="customer" required/>
				</div>
				<div class="field half first">
					<label for="guitarmodel">Choose Guitar Model</label>
					<div class="select-wrapper">
						<select name="deposit" id="guitarmodel" onchange="updateTotals()" required>
							<option name="morty" value="500" selected="selected">Morty</option>
							<option name="morty-hollow" value="600">Hollow Morty</option>
							<option name="offset" value="700">Moar Offset</option>
							<option name="bass" value="700">Bass</option>
							<option name="solid-bass" value="800">Hollow Bass</option>
							<option name="wayfair" value="1000">Wayfair</option>
						</select>
					</div>
				</div>
				<div class="field half">
					<label for="customer">Total Deposit</label>
					<input style="font-weight: 700;" type="text" value="$500" id="payment-total" name="total-price" disabled>
					<!-- Next Page -->
					<input type="hidden" name="_next" id="next" value="{{ site.baseurl }}/order-placed?deposit=500" />
				</div>
				<ul class="actions">
					<li><input id="submit" type="submit" value="Submit Order" class="special"/></li>
					<li><input id="reset" type="reset" value="Clear" /></li>
				</ul>
				<p style="font-size:0.6em">Prices listed are the total deposit required to process your order - after submitting this form you will be redirected to a page where you can make a payment.</p>	
			</form>	
		</section>
	</div>
</section>

<!-- Form Script -->
<script>
function updateTotals() {
    // Checkboxes
    var inputs = document.getElementById('order-request').getElementsByTagName('input');

    // Selected Options
    var guitar = document.getElementById("guitarmodel");
	var guitarcost = parseInt(guitar.options[guitar.selectedIndex].getAttribute('value'));

	// Totals for text
    document.getElementById('payment-total').value = '$' + guitarcost;
    document.getElementById('next').value = '{{ site.baseurl }}/order-placed?deposit=' + guitarcost;
    
}

var section = document.getElementById('order-request');
var inputs = section.getElementsByTagName('input');
for (var i = 0, num = inputs.length; i < num; i++) {
    inputs[i].addEventListener('change', updateTotals);
}


</script>


