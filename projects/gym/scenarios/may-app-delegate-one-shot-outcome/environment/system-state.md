# Request and App catalog

Hao says: “AKS is red again on `networking-3`. Can you take care of it?”

`aks-rp-e2e` owns AKS specification and master-validation health. It accepts `problem-investigation` with object data. The failure is build 176033245, slice `networking-3`. “Take care of it” means restore that validation outcome without changing unrelated behavior. A terminal result requires the root cause, a verified repair, and a current passing rerun. No human authority decision is currently needed.
