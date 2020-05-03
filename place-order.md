---
layout: page
title: Place Order Request
show_tile: false
nav-menu: false
---

<!-- Main -->
<div id="main" class="alt">


<!-- Scripts -->
<script type="text/javascript">

	function showme() {
	  var x = document.getElementById("showme");
	  if (x.style.display === "none") {
	    x.style.display = "block";setTimeout(showPage, 1400);
	    $('html, body').animate({ scrollTop: 0 }, 'fast');
	  } else {
	    x.style.display = "none";
	  }
	};
	function showPage() {
	  document.getElementById("loader").style.display = "none";
	  document.getElementById("order-success-message").style.display = "block";
	  document.getElementById("submit").disabled = true;
	};
</script>


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
			<form id="order-request" method="post" onsubmit="return false">
				<div class="field half first" style="margin-bottom: 0.4em">
					<label for="name">Name</label>
					<input type="text" id="yourname" placeholder="Your name"/>
				</div>
				<div class="field half" style="margin-bottom: 0.4em">
					<label for="email">Email</label>
					<input type="email" id="email" placeholder="Your email"/>
				</div>
				<p style="font-size:0.6em">We capture your name and email at this point in case we need to contact you directly about your order. You will not be signed up to any mailing lists.</p>
				<div class="field">
					<label for="guitarmodel">Choose Guitar Model</label>
					<div class="select-wrapper">
						<select name="guitarmodel" id="guitarmodel">
							<option value="solid-t">Solid Morty (350USD)</option>
							<option value="hollow-t">Hollow Morty (420USD)</option>
							<option value="offset">Moar Offset (500USD)</option>
							<option value="solid-bass">Solid Bass (500USD)</option>
							<option value="hollow-bass">Hollow Bass (450USD)</option>
							<option value="wayfair">Wayfair (750USD)</option>
						</select>
					</div>
					<p style="font-size:0.6em">Prices listed are the total deposit required to process your order - after submitting this form you will be redirected to a page where you can make a payment.</p>	
				</div>
				<div class="row uniform" style="display:none;">
					<div class="4u 12u$(xsmall)">
						<div class="field">
							<label for="wood">Body Wood</label>
							<div class="select-wrapper">
								<select name="wood" id="wood">
									<option value="test">Wood 1</option>
								</select>
							</div>
						</div>
					</div>
					<div class="4u 12u$(xsmall)">
						<div class="field">
							<label for="neck">Neck Radius</label>
							<div class="select-wrapper">
								<select name="neck" id="neck">
									<option value="test">Option 1</option>
								</select>
							</div>
						</div>
					</div>
					<div class="4u 12u$(xsmall)">
						<div class="field">
							<label for="scale">Scale Length</label>
							<div class="select-wrapper">
								<select name="scale" id="scale">
									<option value="test">Option 1</option>
								</select>
							</div>
						</div>
					</div>
				</div>
				<ul class="actions">
					<li><input id="submit" type="submit" value="Continue to Pay" class="special" onclick="showme();"/></li>
					<li><input type="reset" value="Clear" /></li>
				</ul>
			</form>	
			<!-- Scripts -->
			<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
			<script type="text/javascript">
				var form = document.querySelector("#order-request");
				var email = document.querySelector("#email");
				var guitar = document.querySelector("#guitarmodel");
				var wood = document.querySelector("#wood");
				var neck = document.querySelector("#neck");
				var scale = document.querySelector("#scale");

				// When the form is submitted...
				form.addEventListener("submit", function(event) {
				  event.preventDefault();

					// POST the data
					axios.post('https://api.airtable.com/v0/appQjVXW2zEsNMZdB/Orders?api_key=keykx6o2ysAy0m8xs', {
					   	"fields": {
					    	"name": document.getElementById("yourname").value,
					    	"email": email.value,
					      	"guitar": guitar.options[guitar.selectedIndex].value,
					      	"wood": document.getElementById("wood").value,
					      	"neck": document.getElementById("neck").value,
					      	"scale": document.getElementById("scale").value
					    }
				  	});
				});
			</script>
		</section>
	</div>
</section>