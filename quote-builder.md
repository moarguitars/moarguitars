---
title: Wayfair
price: 2500

model:
  	- modeltitle: Solid Morty 
  	slug-value: solid-t
	modelprice: 1500
	- modeltitle: Hollow Morty
	slug-value: hollow-t
	modelprice: 1500
---

<!-- Main -->
<div id="main" class="alt">
<section>
	<form class="inner row" id="extra-features">
		<div class="12u 12u(small)">
			<h1>Guitar Builder</h1>
		</div>
		<div class="8u 12u(small)">
			<h3>Model Info</h3>
			<p>Guitar information</p>
			<p>What base model includes</p>
			<!-- Other Stuff -->
			<!-- Binding -->
			<section style="box-sizing: border-box; padding-right: 2em; margin-bottom: 2em;">
				<h3>Binding</h3>
				<p>Guitar information</p>
				<div class="field half">
					<label for="guitarmodel">Choose Guitar Model</label>
					<div class="select-wrapper">
						<select name="guitarmodel" id="guitarmodel">
							{% for item in page.model %}
							<option value="{{ item.slug-value }}">{{ item.modeltitle }} {{ item.modelprice }}</option>
							{% endfor %}
						</select>
					</div>
				</div>

			  	<table class="alt">
					<tbody>
						<tr> 
							<th width="70%">Item</th>
			    			<th width="30%">$USD</th>
			    		</tr>
			    		<tr>
			    			<td>
			    				<input class="binding" value="160" type="checkbox" id="Checkbox1" data-toggle="checkbox"> 
			    				<label class="checkbox" for="Checkbox1">Top binding</label>
			    			</td>
			    			<td>
			    				<p>$160</p>
			    			</td>
			    		</tr>
			    		<tr>
			    			<td>
			    				<input class="binding" value="160"  type="checkbox" id="Checkbox2" data-toggle="checkbox"> 
								<label class="checkbox" for="Checkbox2">Bottom binding</label>
							</td>
							<td>
								<p>$160</p>
							</td>
						</tr>
						<tr>
			    			<td>
			    				<input class="binding" value="160"  type="checkbox" id="Checkbox3" data-toggle="checkbox"> 
								<label class="checkbox" for="Checkbox3">F-hole binding</label>
							</td>
							<td>
								<p>$160</p>
							</td>
						</tr>
						<tr>
			    			<td>
			    				<input class="binding" value="220"  type="checkbox" id="Checkbox4" data-toggle="checkbox"> 
								<label class="checkbox" for="Checkbox4">Neck binding</label>
							</td>
							<td>
								<p>$220</p>
							</td>
						</tr>
					</tbody>
				</table>
			</section>
			<!-- Hardware -->
			<section style="box-sizing: border-box; padding-right: 2em; margin-bottom: 2em;">
				<h3>Hardware</h3>
				<p>Guitar information</p>
				<table class="alt">
					<tbody>
						<tr> 
							<th width="70%">Item</th>
			    			<th width="30%">$USD</th>
			    		</tr>
						<tr>
							<td>
								<input class="quoteItem" value="45" type="checkbox" id="hardware1" data-toggle="checkbox" name="Gold Hardware and frets"> 
			    				<label class="checkbox" for="hardware1">Gold Hardware and frets</label>
							</td>
							<td>$45</td>
						</tr>
						<tr>
							<td>
								<input class="quoteItem" value="20" type="checkbox" id="hardware2" data-toggle="checkbox" name="Locking tuners over standard"> 
			    				<label class="checkbox" for="hardware2">Locking tuners over standard</label>
							</td>
							<td>$20</td>
						</tr>
					</tbody>
				</table>
			</section>
		</div>
		<div class="box 4u 12u(small) sticky-quote">
			<div class="">
				<h3>Your {{ page.title }}</h3>
				<table>
					<tbody>
						<tr> 
							<th width="70%">Item</th>
			    			<th width="30%">$USD</th>
			    		</tr>
			    		<tr>
							<td width="80%">
								<p>Base Model</p>
							</td>
							<td width="20%">
								$<span>{{page.price}}</span>
							</td>
						</tr>
						<tr>
							<td width="80%">
								Customisations
							</td>
							<td width="20%">
								$<span id="payment-custom">0</span>
							</td>
						</tr>
						<tfoot style="font-weight: 600;">
							<td width="80%">
								<p>Total</p>
							</td>
							<td width="20%">
								$<span id="payment-total">{{page.price}}</span>
							</td>
						</tfoot>
			        </tbody>
			    </table>
			    <ul class="actions" style="">
					<li style="width:100%; padding:0;"><input id="submit" type="submit" value="Submit Quote" class="button special fit" onclick="showme();"/></li>
					<li style="width:100%; padding:0;"><input id="reset" type="reset" value="Clear Customisations" class="button small fit"  onclick="setTimeout(updateTotals,20);" /></li>
				</ul>
			</div>
		</div>
	</form>
</section>

<!-- Form Script -->
		<script>
		function updateTotals() {
		    var inputs = document.getElementById('extra-features').getElementsByTagName('input');

		    var sum = {{ page.price }};
		    for (var i = 0, num = inputs.length; i < num; i++) {
		        if (inputs[i].checked) {
		            sum += parseInt(inputs[i].getAttribute('value'));
		        }
		    }

		    var customisations = sum - {{ page.price }};

		    document.getElementById('payment-custom').innerHTML = customisations;
		    document.getElementById('payment-total').innerHTML = sum;
		    
		}
		var section = document.getElementById('extra-features');
		var inputs = section.getElementsByTagName('input');
		for (var i = 0, num = inputs.length; i < num; i++) {
		    inputs[i].addEventListener('change', updateTotals);
		}
		</script>
</div>