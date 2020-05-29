---
title: Wayfair
price: 2500
---

<!-- Main -->
<div id="main" class="alt">
<section>
	<div class="inner row" id="extra-features">
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
			</div>
		</div>


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


		<!-- Quote List Script -->

		<script>
			// we want to define a objec that "stores" the state of our checkbox items
			const checkedItems = {};


			function returnCheckboxName(item) {  
			  return item.name;
			}

			function removeNotCheckedItems(item) {  
			  return !!item.isChecked;
			}

			// updates the DOM item "checked-items"
			function updateCheckedItemsList() {
				const checkedItemListEl = document.getElementById('checked-items');
			    
			  // Object.values converts an object's values into an array 
			  // we filter through this array removing any instance where isChecked is false
			  // then map through the array to only return the checkbox name
			  checkedItemListEl.innerHTML = Object.values(checkedItems)
			      .filter(removeNotCheckedItems).map(returnCheckboxName);
			}

			function onClickCheckbox(e) {
			  const checkboxName = e.target.name;
				const status = e.target.checked;

			  checkedItems[checkboxName] = {
			  		isChecked: !!status,
			      name: checkboxName
			  };
			  
			  updateCheckedItemsList();
			}


			window.onload = function(){
				const allCheckbox = document.getElementsByClassName('binding');
			  
			  
			  for (let checkbox of allCheckbox) {
			    checkbox.addEventListener('click', onClickCheckbox)
			  }
			}
		</script>


	</div>
</section>
</div>