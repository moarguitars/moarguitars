---
layout: page
title: Place Order Request
show_tile: false
nav-menu: false
---

<!-- Main -->
<div id="main" class="alt">
<section>
	<div class="inner row" id="extra-features">
		<div class="12u 12u(small)">
			<h1>Quote Builder</h1>
		</div>
		<div class="6u 12u(small)">
			<h3>Guitar Info</h3>
			<p>Guitar information</p>
		</div>
		<div class="6u 12u(small)">
			<h3>Extras</h3>
			<!-- Binding -->
			<button class="accordion">Binding</button>
			<div class="panel" id="binding">
				<div class="100% row">
				  	<table class="alt">
						<tbody>
							<tr> 
								<th width="70%">Item</th>
				    			<th width="30%">Price (USD)</th>
				    		</tr>
				    		<tr>
				    			<td>
				    				<input class="binding" value="160" type="checkbox" id="Checkbox1" data-toggle="checkbox"> 
				    				<label class="checkbox" for="Checkbox1">Top binding</label>
				    			</td>
				    			<td>
				    				<p>160</p>
				    			</td>
				    		</tr>
				    		<tr>
				    			<td>
				    				<input class="binding" value="160"  type="checkbox" id="Checkbox2" data-toggle="checkbox"> 
									<label class="checkbox" for="Checkbox2">Bottom binding</label>
								</td>
								<td>
									<p>160</p>
								</td>
							</tr>
							<tr>
				    			<td>
				    				<input class="binding" value="160"  type="checkbox" id="Checkbox3" data-toggle="checkbox"> 
									<label class="checkbox" for="Checkbox3">F-hole binding</label>
								</td>
								<td>
									<p>160</p>
								</td>
							</tr>
							<tr>
				    			<td>
				    				<input class="binding" value="220"  type="checkbox" id="Checkbox4" data-toggle="checkbox"> 
									<label class="checkbox" for="Checkbox4">Neck binding</label>
								</td>
								<td>
									<p>220</p>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
			<!-- Hardware -->
			<button class="accordion">Hardware</button>
			<div class="panel">
			  <table class="alt">
					<tbody>
						<tr> 
							<th width="70%">Item</th>
			    			<th width="30%">Price (USD)</th>
			    		</tr>
						<tr>
							<td>
								<input value="45" type="checkbox" id="hardware1" data-toggle="checkbox" name="Gold Hardware and frets"> 
			    				<label class="checkbox" for="hardware1">Gold Hardware and frets</label>
							</td>
							<td>45</td>
						</tr>
						<tr>
							<td>
								<input value="20" type="checkbox" id="hardware2" data-toggle="checkbox" name="Locking tuners over standard"> 
			    				<label class="checkbox" for="hardware2">Locking tuners over standard</label>
							</td>
							<td>20</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
		<div class="12u 12u(small)">
			<!-- Totals -->
			<h3>Your Guitar</h3>
			<div>
				<table>
					<tbody>
						<tr>
							<td width="80%">
								<p>Total</p>
							</td>
							<td width="20%">
								$<span id="payment-total">0</span>
							</td>
						</tr>
						<tr>
							<td>
								<span id="quoteList">You've not selected anything yet</span>
							</td>
							<td>
								<span></span>
							</td>
						</tr>
			        </tbody>
			    </table>
			</div>
		</div>


		<!-- Form Script -->
		<script>
		function updateTotals() {
		    var inputs = document.getElementById('extra-features').getElementsByTagName('input');
		        
		    var sum = 0;
		    for (var i = 0, num = inputs.length; i < num; i++) {
		        if (inputs[i].checked) {
		            sum += parseInt(inputs[i].getAttribute('value'));
		        }
		    }

		    document.getElementById('payment-total').innerHTML = sum;
		    
		}
		var section = document.getElementById('extra-features');
		var inputs = section.getElementsByTagName('input');
		for (var i = 0, num = inputs.length; i < num; i++) {
		    inputs[i].addEventListener('change', updateTotals);
		}
		</script>

		<!-- Count the things -->
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
				const checkedItemListEl = document.getElementById('quoteList');
			    
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
				const allCheckboxes = document.getElementsByClassName('binding');
			  
			  
			  for (let checkbox of allCheckboxes) {
			    checkbox.addEventListener('click', onClickCheckbox)
			  }
			}
		</script>

		<!-- Accordian Script -->
		<script>
		var acc = document.getElementsByClassName("accordion");
		var i;

		for (i = 0; i < acc.length; i++) {
		  acc[i].addEventListener("click", function() {
		    /* Toggle between adding and removing the "active" class,
		    to highlight the button that controls the panel */
		    this.classList.toggle("active");

		    /* Toggle between hiding and showing the active panel */
		    var panel = this.nextElementSibling;
		    if (panel.style.display === "block") {
		      panel.style.display = "none";
		    } else {
		      panel.style.display = "block";
		    }
		  });
		}

			function openCity(evt, cityName) {
		  // Declare all variables
		  var i, tabcontent, tablinks;

		  // Get all elements with class="tabcontent" and hide them
		  tabcontent = document.getElementsByClassName("tabcontent");
		  for (i = 0; i < tabcontent.length; i++) {
		    tabcontent[i].style.display = "none";
		  }

		  // Get all elements with class="tablinks" and remove the class "active"
		  tablinks = document.getElementsByClassName("tablinks");
		  for (i = 0; i < tablinks.length; i++) {
		    tablinks[i].className = tablinks[i].className.replace(" active", "");
		  }

		  // Show the current tab, and add an "active" class to the button that opened the tab
		  document.getElementById(cityName).style.display = "block";
		  evt.currentTarget.className += " active";
		}
		</script>
	</div>
</section>
</div>