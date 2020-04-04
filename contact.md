---
layout: page
title: Pricing & Shipping
description: 'More information about pricing and shipping'
seo_description:
show_tile: false
nav-menu: false
---

<!-- Main -->
<div id="main" class="alt">



<!-- Intro -->
<section>
	<div class="inner">
		<section style="margin-top: 6em">
			<h2>Order Now</h2>
			<p>So you’ve gone through my site and have come to the excellent decision that you want to order a guitar. First off thanks! That’s brilliant news, welcome to the family! To commit you and I to the build, and to get onto my waiting list, simply pay a deposit here via paypal. Waiting list is currently about 4 months from me receiving the deposit to you receiving your guitar.</p> 
			<p>Alongside the deposit please fill in this contact form with your email address, and what kind of guitar you want to order (be as specific as you can!)</p>
			<p>I will write to you as soon as I receive the deposit to thank you for your order, to go over and confirm the build details, and to start up the dialogue about your commission.</p>
			<p>Please note that the deposit prices are taken from base price models, so if you are ordering a guitar with optional extras, the final price may be higher.</p>
			<script type="text/javascript">
			    window.onload = function(){
			        location.href=document.getElementById("selectbox").value;
			    }       
			</script>
			<form action="https://formspree.io/{{ site.email }}" method="POST">
				<div class="field half first">
					<label for="name">Name</label>
					<input type="text" name="name" id="name" />
				</div>
				<div class="field half">
					<label for="email">Email</label>
					<input type="text" name="_replyto" id="email" />
				</div>
				<div class="field">
					<label for="email">Model</label>
					<select name="guitarmodel" id="guitarmodel">
						<option value="">- Select Model -</option>
						<option value="https://www.yahoo.com/">Solid T (500USD Deposit)</option>
						<option value="https://www.google.com/">Hollow T (600USD Deposit)</option>
						<option value="https://www.facebook.com/">Moar Offset (700USD Deposit)</option>
						<option value="https://www.twitter.com/">Solid Bass (700USD Deposit)</option>
						<option value="https://www.linkedin.com/">Hollow Bass (800USD Deposit)</option>
						<option value="https://www.bbc.co.uk/">Wayfair (1000USD Deposit)</option>
					</select>
				</div>
				<div class="field">
					<label for="email">Payment Method</label>
					<select name="payment" id="payment">
						<option value="">Paypal</option>
					</select>
				</div>
				<div class="field">
					<label for="message">Message</label>
					<textarea name="message" id="message" rows="6"></textarea>
				</div>
				<ul class="actions">
					<li><input type="submit" value="Send Message" class="special" onClick="window.open(guitarmodel.value,'newtab')"/></li>
					<li><input type="reset" value="Clear" /></li>
				</ul>
			</form>
		</section>
	</div>
</section>

