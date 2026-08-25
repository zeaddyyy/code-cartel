# ANPR status

Vehicle detections can trigger the optional ANPR processor in
`ai-service/anpr.py`. The processor requires a real plate detector model and
OCR dependency. `ANPR_ENABLED=false` is the safe default. If dependencies are
missing, the service reports unavailable state and stores the vehicle event
without a plate number. It never fabricates plates, owner identity, vehicle
make/model, or watchlist matches.
