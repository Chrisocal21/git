'use client'

import { useEffect, useRef, useState } from 'react'
import { FlightSegment } from '@/types/fldr'

// Airport coordinates and location database - Major US Airports
interface AirportInfo {
  coords: [number, number]
  city: string
  state: string
  name: string
}

const AIRPORT_INFO: Record<string, AirportInfo> = {
  // Major Hubs
  'ATL': { coords: [33.6407, -84.4277], city: 'Atlanta', state: 'GA', name: 'Hartsfield-Jackson' },
  'ORD': { coords: [41.9742, -87.9073], city: 'Chicago', state: 'IL', name: "O'Hare" },
  'DFW': { coords: [32.8998, -97.0403], city: 'Dallas', state: 'TX', name: 'Dallas/Fort Worth' },
  'DAL': { coords: [32.8471, -96.8518], city: 'Dallas', state: 'TX', name: 'Love Field' },
  'DEN': { coords: [39.8561, -104.6737], city: 'Denver', state: 'CO', name: 'International' },
  'LAX': { coords: [33.9416, -118.4085], city: 'Los Angeles', state: 'CA', name: 'International' },
  'JFK': { coords: [40.6413, -73.7781], city: 'New York', state: 'NY', name: 'JFK' },
  'SFO': { coords: [37.6213, -122.3790], city: 'San Francisco', state: 'CA', name: 'International' },
  'BOS': { coords: [42.3656, -71.0096], city: 'Boston', state: 'MA', name: 'Logan' },
  'MIA': { coords: [25.7959, -80.2870], city: 'Miami', state: 'FL', name: 'International' },
  'MCO': { coords: [28.4312, -81.3081], city: 'Orlando', state: 'FL', name: 'International' },
  'PHX': { coords: [33.4352, -112.0101], city: 'Phoenix', state: 'AZ', name: 'Sky Harbor' },
  'LAS': { coords: [36.0840, -115.1537], city: 'Las Vegas', state: 'NV', name: 'Harry Reid' },
  'SEA': { coords: [47.4502, -122.3088], city: 'Seattle', state: 'WA', name: 'Tacoma Int.' },
  'SAN': { coords: [32.7338, -117.1933], city: 'San Diego', state: 'CA', name: 'International' },
  'IAH': { coords: [29.9902, -95.3368], city: 'Houston', state: 'TX', name: 'Bush Int.' },
  'HOU': { coords: [29.6454, -95.2789], city: 'Houston', state: 'TX', name: 'Hobby' },
  'CLT': { coords: [35.2144, -80.9473], city: 'Charlotte', state: 'NC', name: 'Douglas' },
  'EWR': { coords: [40.6895, -74.1745], city: 'Newark', state: 'NJ', name: 'Liberty' },
  'MSP': { coords: [44.8848, -93.2223], city: 'Minneapolis', state: 'MN', name: 'St. Paul Int.' },
  'DTW': { coords: [42.2162, -83.3554], city: 'Detroit', state: 'MI', name: 'Metro Wayne County' },
  'PHL': { coords: [39.8729, -75.2437], city: 'Philadelphia', state: 'PA', name: 'International' },
  'BNA': { coords: [36.1263, -86.6681], city: 'Nashville', state: 'TN', name: 'International' },
  'IND': { coords: [39.7173, -86.2944], city: 'Indianapolis', state: 'IN', name: 'International' },
  'AUS': { coords: [30.1945, -97.6699], city: 'Austin', state: 'TX', name: 'Bergstrom' },
  'BWI': { coords: [39.1774, -76.6684], city: 'Baltimore', state: 'MD', name: 'Washington Int.' },
  'IAD': { coords: [38.9531, -77.4565], city: 'Washington', state: 'DC', name: 'Dulles' },
  'DCA': { coords: [38.8521, -77.0377], city: 'Washington', state: 'DC', name: 'Reagan National' },
  'RDU': { coords: [35.8801, -78.7880], city: 'Raleigh-Durham', state: 'NC', name: 'Int. Airport' },
  'SLC': { coords: [40.7899, -111.9791], city: 'Salt Lake City', state: 'UT', name: 'International' },
  'PDX': { coords: [45.5898, -122.5951], city: 'Portland', state: 'OR', name: 'International' },
  'TPA': { coords: [27.9755, -82.5332], city: 'Tampa', state: 'FL', name: 'International' },
  'STL': { coords: [38.7487, -90.3700], city: 'St. Louis', state: 'MO', name: 'Lambert' },
  'MSY': { coords: [29.9902, -90.2580], city: 'New Orleans', state: 'LA', name: 'Louis Armstrong' },
  'FLL': { coords: [26.0726, -80.1528], city: 'Fort Lauderdale', state: 'FL', name: 'Hollywood Int.' },
  'SJC': { coords: [37.3626, -121.9290], city: 'San Jose', state: 'CA', name: 'International'  },
  'OAK': { coords: [37.7126, -122.2197], city: 'Oakland', state: 'CA', name: 'International' },
  'HNL': { coords: [21.3187, -157.9225], city: 'Honolulu', state: 'HI', name: 'International' },
  'MCI': { coords: [39.2976, -94.7139], city: 'Kansas City', state: 'MO', name: 'International' },
  'SMF': { coords: [38.6954, -121.5908], city: 'Sacramento', state: 'CA', name: 'International' },
  'JAX': { coords: [30.4941, -81.6879], city: 'Jacksonville', state: 'FL', name: 'International' },
  // Northeast additions
  'LGA': { coords: [40.7769, -73.8740], city: 'New York', state: 'NY', name: 'LaGuardia' },
  'BDL': { coords: [41.9389, -72.6832], city: 'Hartford', state: 'CT', name: 'Bradley Int.' },
  'PVD': { coords: [41.7240, -71.4281], city: 'Providence', state: 'RI', name: 'T.F. Green' },
  'BUF': { coords: [42.9405, -78.7322], city: 'Buffalo', state: 'NY', name: 'Niagara Int.' },
  'ROC': { coords: [43.1189, -77.6724], city: 'Rochester', state: 'NY', name: 'Greater Rochester' },
  'SYR': { coords: [43.1112, -76.1063], city: 'Syracuse', state: 'NY', name: 'Hancock Int.' },
  'ALB': { coords: [42.7483, -73.8017], city: 'Albany', state: 'NY', name: 'Albany Int.' },
  'MHT': { coords: [42.9326, -71.4357], city: 'Manchester', state: 'NH', name: 'Manchester-Boston' },
  'PIT': { coords: [40.4915, -80.2329], city: 'Pittsburgh', state: 'PA', name: 'Pittsburgh Int.' },
  // Southeast additions
  'RSW': { coords: [26.5362, -81.7552], city: 'Fort Myers', state: 'FL', name: 'SW Florida Int.' },
  'PBI': { coords: [26.6832, -80.0956], city: 'West Palm Beach', state: 'FL', name: 'Palm Beach Int.' },
  'RIC': { coords: [37.5052, -77.3197], city: 'Richmond', state: 'VA', name: 'Richmond Int.' },
  'GSO': { coords: [36.0978, -79.9373], city: 'Greensboro', state: 'NC', name: 'Piedmont Triad' },
  'SAV': { coords: [32.1276, -81.2021], city: 'Savannah', state: 'GA', name: 'Savannah/Hilton Head' },
  'CHS': { coords: [32.8986, -80.0405], city: 'Charleston', state: 'SC', name: 'Charleston Int.' },
  'MEM': { coords: [35.0424, -89.9767], city: 'Memphis', state: 'TN', name: 'Memphis Int.' },
  // Midwest additions
  'MDW': { coords: [41.7868, -87.7522], city: 'Chicago', state: 'IL', name: 'Midway' },
  'CLE': { coords: [41.4117, -81.8498], city: 'Cleveland', state: 'OH', name: 'Hopkins Int.' },
  'CVG': { coords: [39.0488, -84.6678], city: 'Cincinnati', state: 'KY', name: 'CVG Int.' },
  'CMH': { coords: [39.9980, -82.8919], city: 'Columbus', state: 'OH', name: 'John Glenn' },
  'MKE': { coords: [42.9472, -87.8966], city: 'Milwaukee', state: 'WI', name: 'Mitchell Int.' },
  'ICT': { coords: [37.6499, -97.4331], city: 'Wichita', state: 'KS', name: 'Eisenhower Nat.' },
  'OMA': { coords: [41.3032, -95.8941], city: 'Omaha', state: 'NE', name: 'Eppley Airfield' },
  'DSM': { coords: [41.5340, -93.6631], city: 'Des Moines', state: 'IA', name: 'Des Moines Int.' },
  'GRR': { coords: [42.8808, -85.5228], city: 'Grand Rapids', state: 'MI', name: 'Gerald R. Ford' },
  // Southwest additions
  'TUS': { coords: [32.1161, -110.9410], city: 'Tucson', state: 'AZ', name: 'Tucson Int.' },
  'ABQ': { coords: [35.0402, -106.6092], city: 'Albuquerque', state: 'NM', name: 'Sunport' },
  'ELP': { coords: [31.8072, -106.3778], city: 'El Paso', state: 'TX', name: 'El Paso Int.' },
  'SNA': { coords: [33.6757, -117.8682], city: 'Santa Ana', state: 'CA', name: 'John Wayne' },
  'ONT': { coords: [34.0560, -117.6012], city: 'Ontario', state: 'CA', name: 'Ontario Int.' },
  'BUR': { coords: [34.2007, -118.3587], city: 'Burbank', state: 'CA', name: 'Hollywood Burbank' },
  // Mountain West additions
  'BOI': { coords: [43.5644, -116.2228], city: 'Boise', state: 'ID', name: 'Boise Airport' },
  'ANC': { coords: [61.1743, -149.9962], city: 'Anchorage', state: 'AK', name: 'Ted Stevens' },
  'FAI': { coords: [64.8151, -147.8562], city: 'Fairbanks', state: 'AK', name: 'Fairbanks Int.' },
  'RNO': { coords: [39.4991, -119.7681], city: 'Reno', state: 'NV', name: 'Reno-Tahoe' },
  'BIL': { coords: [45.8077, -108.5430], city: 'Billings', state: 'MT', name: 'Logan Int.' },
  'MSO': { coords: [46.9163, -114.0906], city: 'Missoula', state: 'MT', name: 'Missoula Int.' },
  // Texas additions
  'SAT': { coords: [29.5337, -98.4698], city: 'San Antonio', state: 'TX', name: 'San Antonio Int.' },
  // Hawaii additions
  'OGG': { coords: [20.8986, -156.4305], city: 'Maui', state: 'HI', name: 'Kahului' },
  'KOA': { coords: [19.7388, -156.0456], city: 'Kona', state: 'HI', name: 'Ellison Onizuka' },
  'LIH': { coords: [21.9760, -159.3390], city: 'Kauai', state: 'HI', name: 'Lihue' },
  // More US Regional Airports
  'BTV': { coords: [44.4719, -73.1533], city: 'Burlington', state: 'VT', name: 'Burlington Int.' },
  'PWM': { coords: [43.6456, -70.3093], city: 'Portland', state: 'ME', name: 'Portland Int.' },
  'BGR': { coords: [44.8074, -68.8281], city: 'Bangor', state: 'ME', name: 'Bangor Int.' },
  'AVL': { coords: [35.4362, -82.5418], city: 'Asheville', state: 'NC', name: 'Asheville Regional' },
  'GSP': { coords: [34.8957, -82.2189], city: 'Greenville', state: 'SC', name: 'Greenville-Spartanburg' },
  'CAE': { coords: [33.9388, -81.1195], city: 'Columbia', state: 'SC', name: 'Columbia Metro' },
  'TYS': { coords: [35.8111, -83.9940], city: 'Knoxville', state: 'TN', name: 'McGhee Tyson' },
  'CHA': { coords: [35.0353, -85.2038], city: 'Chattanooga', state: 'TN', name: 'Chattanooga Metro' },
  'LIT': { coords: [34.7294, -92.2243], city: 'Little Rock', state: 'AR', name: 'Clinton National' },
  'XNA': { coords: [36.2819, -94.3069], city: 'Fayetteville', state: 'AR', name: 'Northwest Arkansas' },
  'TUL': { coords: [36.1984, -95.8881], city: 'Tulsa', state: 'OK', name: 'Tulsa Int.' },
  'OKC': { coords: [35.3931, -97.6007], city: 'Oklahoma City', state: 'OK', name: 'Will Rogers World' },
  'SHV': { coords: [32.4466, -93.8256], city: 'Shreveport', state: 'LA', name: 'Shreveport Regional' },
  'BTR': { coords: [30.5332, -91.1496], city: 'Baton Rouge', state: 'LA', name: 'Baton Rouge Metro' },
  'MGM': { coords: [32.3006, -86.3940], city: 'Montgomery', state: 'AL', name: 'Montgomery Regional' },
  'BHM': { coords: [33.5629, -86.7535], city: 'Birmingham', state: 'AL', name: 'Birmingham-Shuttlesworth' },
  'MOB': { coords: [30.6913, -88.2428], city: 'Mobile', state: 'AL', name: 'Mobile Regional' },
  'PNS': { coords: [30.4734, -87.1866], city: 'Pensacola', state: 'FL', name: 'Pensacola Int.' },
  'VPS': { coords: [30.4832, -86.5254], city: 'Valparaiso', state: 'FL', name: 'Destin-Fort Walton Beach' },
  'TLH': { coords: [30.3965, -84.3503], city: 'Tallahassee', state: 'FL', name: 'Tallahassee Int.' },
  'GNV': { coords: [29.6900, -82.2718], city: 'Gainesville', state: 'FL', name: 'Gainesville Regional' },
  'DAB': { coords: [29.1799, -81.0581], city: 'Daytona Beach', state: 'FL', name: 'Daytona Beach Int.' },
  'SRQ': { coords: [27.3954, -82.5544], city: 'Sarasota', state: 'FL', name: 'Sarasota-Bradenton' },
  'PIE': { coords: [27.9102, -82.6874], city: 'St. Petersburg', state: 'FL', name: 'St. Pete-Clearwater' },
  'EYW': { coords: [24.5561, -81.7594], city: 'Key West', state: 'FL', name: 'Key West Int.' },
  'LBB': { coords: [33.6636, -101.8228], city: 'Lubbock', state: 'TX', name: 'Lubbock Preston Smith' },
  'MAF': { coords: [31.9425, -102.2019], city: 'Midland', state: 'TX', name: 'Midland Int.' },
  'AMA': { coords: [35.2194, -101.7059], city: 'Amarillo', state: 'TX', name: 'Rick Husband Amarillo' },
  'CRP': { coords: [27.7704, -97.5012], city: 'Corpus Christi', state: 'TX', name: 'Corpus Christi Int.' },
  'BRO': { coords: [25.9068, -97.4259], city: 'Brownsville', state: 'TX', name: 'Brownsville/South Padre' },
  'FAR': { coords: [46.9207, -96.8158], city: 'Fargo', state: 'ND', name: 'Hector Int.' },
  'BIS': { coords: [46.7727, -100.7467], city: 'Bismarck', state: 'ND', name: 'Bismarck Municipal' },
  'FSD': { coords: [43.5820, -96.7420], city: 'Sioux Falls', state: 'SD', name: 'Sioux Falls Regional' },
  'RAP': { coords: [44.0453, -103.0574], city: 'Rapid City', state: 'SD', name: 'Rapid City Regional' },
  'CID': { coords: [41.8847, -91.7108], city: 'Cedar Rapids', state: 'IA', name: 'The Eastern Iowa' },
  'MSN': { coords: [43.1399, -89.3375], city: 'Madison', state: 'WI', name: 'Dane County Regional' },
  'GRB': { coords: [44.4851, -88.1296], city: 'Green Bay', state: 'WI', name: 'Austin Straubel Int.' },
  'TOL': { coords: [41.5868, -83.8078], city: 'Toledo', state: 'OH', name: 'Toledo Express' },
  'DAY': { coords: [39.9024, -84.2194], city: 'Dayton', state: 'OH', name: 'James M. Cox Dayton' },
  'LEX': { coords: [38.0365, -84.6059], city: 'Lexington', state: 'KY', name: 'Blue Grass' },
  'SDF': { coords: [38.1744, -85.7360], city: 'Louisville', state: 'KY', name: 'Louisville Int.' },
  'FWA': { coords: [40.9785, -85.1951], city: 'Fort Wayne', state: 'IN', name: 'Fort Wayne Int.' },
  'SBN': { coords: [41.7086, -86.3172], city: 'South Bend', state: 'IN', name: 'South Bend Int.' },
  'EVV': { coords: [38.0370, -87.5324], city: 'Evansville', state: 'IN', name: 'Evansville Regional' },
  'LAN': { coords: [42.7787, -84.5874], city: 'Lansing', state: 'MI', name: 'Capital Region Int.' },
  'FNT': { coords: [42.9654, -83.7436], city: 'Flint', state: 'MI', name: 'Bishop Int.' },
  'TVC': { coords: [44.7414, -85.5822], city: 'Traverse City', state: 'MI', name: 'Cherry Capital' },
  'MQT': { coords: [46.3536, -87.3954], city: 'Marquette', state: 'MI', name: 'Sawyer Int.' },
  'ATW': { coords: [44.2581, -88.5191], city: 'Appleton', state: 'WI', name: 'Appleton Int.' },
  'RST': { coords: [43.9083, -92.5000], city: 'Rochester', state: 'MN', name: 'Rochester Int.' },
  'DLH': { coords: [46.8420, -92.1936], city: 'Duluth', state: 'MN', name: 'Duluth Int.' },
  'SPI': { coords: [39.8441, -89.6779], city: 'Springfield', state: 'IL', name: 'Abraham Lincoln Capital' },
  'PIA': { coords: [40.6642, -89.6933], city: 'Peoria', state: 'IL', name: 'General Downing Int.' },
  'MLI': { coords: [41.4485, -90.5075], city: 'Moline', state: 'IL', name: 'Quad City Int.' },
  'BMI': { coords: [40.4771, -88.9159], city: 'Bloomington', state: 'IL', name: 'Central Illinois Regional' },
  'SGF': { coords: [37.2457, -93.3886], city: 'Springfield', state: 'MO', name: 'Springfield-Branson Nat.' },
  'COU': { coords: [38.8181, -92.2196], city: 'Columbia', state: 'MO', name: 'Columbia Regional' },
  'SUX': { coords: [42.4026, -96.3843], city: 'Sioux City', state: 'IA', name: 'Sioux Gateway' },
  'FCA': { coords: [48.3105, -114.2559], city: 'Kalispell', state: 'MT', name: 'Glacier Park Int.' },
  'GTF': { coords: [47.4820, -111.3707], city: 'Great Falls', state: 'MT', name: 'Great Falls Int.' },
  'BZN': { coords: [45.7769, -111.1603], city: 'Bozeman', state: 'MT', name: 'Bozeman Yellowstone' },
  'JAC': { coords: [43.6073, -110.7377], city: 'Jackson', state: 'WY', name: 'Jackson Hole' },
  'CPR': { coords: [42.9080, -106.4642], city: 'Casper', state: 'WY', name: 'Casper-Natrona County' },
  'GEG': { coords: [47.6199, -117.5338], city: 'Spokane', state: 'WA', name: 'Spokane Int.' },
  'PSC': { coords: [46.2647, -119.1190], city: 'Pasco', state: 'WA', name: 'Tri-Cities' },
  'EUG': { coords: [44.1246, -123.2117], city: 'Eugene', state: 'OR', name: 'Mahlon Sweet Field' },
  'MFR': { coords: [42.3742, -122.8733], city: 'Medford', state: 'OR', name: 'Rogue Valley Int.' },
  'RDM': { coords: [44.2541, -121.1497], city: 'Redmond', state: 'OR', name: 'Roberts Field' },
  'PSP': { coords: [33.8297, -116.5067], city: 'Palm Springs', state: 'CA', name: 'Palm Springs Int.' },
  'SBA': { coords: [34.4262, -119.8403], city: 'Santa Barbara', state: 'CA', name: 'Santa Barbara Municipal' },
  'FAT': { coords: [36.7762, -119.7181], city: 'Fresno', state: 'CA', name: 'Fresno Yosemite Int.' },
  'STS': { coords: [38.5089, -122.8128], city: 'Santa Rosa', state: 'CA', name: 'Charles M. Schulz Sonoma' },
  'MOD': { coords: [37.6258, -120.9542], city: 'Modesto', state: 'CA', name: 'Modesto City-County' },
  'RDD': { coords: [40.5090, -122.2934], city: 'Redding', state: 'CA', name: 'Redding Municipal' },
  'MRY': { coords: [36.5870, -121.8429], city: 'Monterey', state: 'CA', name: 'Monterey Regional' },
  'SBP': { coords: [35.2368, -120.6424], city: 'San Luis Obispo', state: 'CA', name: 'San Luis Obispo County' },
  'BFL': { coords: [35.4336, -119.0568], city: 'Bakersfield', state: 'CA', name: 'Meadows Field' },
  'IYK': { coords: [32.8342, -115.5692], city: 'Yuma', state: 'AZ', name: 'Yuma Int.' },
  'FLG': { coords: [35.1385, -111.6713], city: 'Flagstaff', state: 'AZ', name: 'Flagstaff Pulliam' },
  'GJT': { coords: [39.1223, -108.5267], city: 'Grand Junction', state: 'CO', name: 'Grand Junction Regional' },
  'ASE': { coords: [39.2232, -106.8690], city: 'Aspen', state: 'CO', name: 'Aspen-Pitkin County' },
  'EGE': { coords: [39.6426, -106.9177], city: 'Eagle', state: 'CO', name: 'Eagle County Regional' },
  'COS': { coords: [38.8058, -104.7002], city: 'Colorado Springs', state: 'CO', name: 'Colorado Springs' },
  'PVU': { coords: [40.2192, -111.7233], city: 'Provo', state: 'UT', name: 'Provo Municipal' },
  'SGU': { coords: [37.0364, -113.5103], city: 'St. George', state: 'UT', name: 'St. George Regional' },
  // Canada Major Airports
  'YYZ': { coords: [43.6777, -79.6248], city: 'Toronto', state: 'ON', name: 'Pearson Int.' },
  'YVR': { coords: [49.1947, -123.1815], city: 'Vancouver', state: 'BC', name: 'Vancouver Int.' },
  'YUL': { coords: [45.4706, -73.7408], city: 'Montreal', state: 'QC', name: 'Pierre Elliott Trudeau' },
  'YYC': { coords: [51.1314, -114.0107], city: 'Calgary', state: 'AB', name: 'Calgary Int.' },
  'YEG': { coords: [53.3097, -113.5797], city: 'Edmonton', state: 'AB', name: 'Edmonton Int.' },
  'YOW': { coords: [45.3225, -75.6692], city: 'Ottawa', state: 'ON', name: 'Ottawa Macdonald-Cartier' },
  'YWG': { coords: [49.9100, -97.2399], city: 'Winnipeg', state: 'MB', name: 'James Armstrong Richardson' },
  'YHZ': { coords: [44.8808, -63.5086], city: 'Halifax', state: 'NS', name: 'Halifax Stanfield' },
  'YYJ': { coords: [48.6469, -123.4258], city: 'Victoria', state: 'BC', name: 'Victoria Int.' },
  // Mexico Major Airports
  'MEX': { coords: [19.4363, -99.0721], city: 'Mexico City', state: 'MX', name: 'Benito Juarez Int.' },
  'CUN': { coords: [21.0365, -86.8770], city: 'Cancun', state: 'MX', name: 'Cancun Int.' },
  'GDL': { coords: [20.5218, -103.3117], city: 'Guadalajara', state: 'MX', name: 'Miguel Hidalgo y Costilla' },
  'MTY': { coords: [25.7785, -100.1077], city: 'Monterrey', state: 'MX', name: 'General Mariano Escobedo' },
  'TIJ': { coords: [32.5411, -116.9701], city: 'Tijuana', state: 'MX', name: 'General Abelardo L. Rodriguez' },
  'PVR': { coords: [20.6801, -105.2544], city: 'Puerto Vallarta', state: 'MX', name: 'Licenciado Gustavo Diaz Ordaz' },
  'SJD': { coords: [23.1518, -109.7211], city: 'Los Cabos', state: 'MX', name: 'Los Cabos Int.' },
  // Europe Major Airports
  'LHR': { coords: [51.4700, -0.4543], city: 'London', state: 'UK', name: 'Heathrow' },
  'LGW': { coords: [51.1537, -0.1821], city: 'London', state: 'UK', name: 'Gatwick' },
  'CDG': { coords: [49.0097, 2.5479], city: 'Paris', state: 'FR', name: 'Charles de Gaulle' },
  'FRA': { coords: [50.0379, 8.5622], city: 'Frankfurt', state: 'DE', name: 'Frankfurt' },
  'AMS': { coords: [52.3105, 4.7683], city: 'Amsterdam', state: 'NL', name: 'Schiphol' },
  'MAD': { coords: [40.4719, -3.5626], city: 'Madrid', state: 'ES', name: 'Adolfo Suarez Madrid-Barajas' },
  'BCN': { coords: [41.2974, 2.0833], city: 'Barcelona', state: 'ES', name: 'Barcelona-El Prat' },
  'FCO': { coords: [41.8003, 12.2389], city: 'Rome', state: 'IT', name: 'Fiumicino' },
  'MXP': { coords: [45.6306, 8.7231], city: 'Milan', state: 'IT', name: 'Malpensa' },
  'MUC': { coords: [48.3538, 11.7861], city: 'Munich', state: 'DE', name: 'Munich' },
  'ZRH': { coords: [47.4647, 8.5492], city: 'Zurich', state: 'CH', name: 'Zurich' },
  'VIE': { coords: [48.1103, 16.5697], city: 'Vienna', state: 'AT', name: 'Vienna Int.' },
  'CPH': { coords: [55.6181, 12.6561], city: 'Copenhagen', state: 'DK', name: 'Copenhagen' },
  'ARN': { coords: [59.6519, 17.9186], city: 'Stockholm', state: 'SE', name: 'Arlanda' },
  'OSL': { coords: [60.1939, 11.1004], city: 'Oslo', state: 'NO', name: 'Gardermoen' },
  'HEL': { coords: [60.3172, 24.9633], city: 'Helsinki', state: 'FI', name: 'Vantaa' },
  'DUB': { coords: [53.4213, -6.2701], city: 'Dublin', state: 'IE', name: 'Dublin' },
  'LIS': { coords: [38.7813, -9.1359], city: 'Lisbon', state: 'PT', name: 'Portela' },
  'BRU': { coords: [50.9010, 4.4844], city: 'Brussels', state: 'BE', name: 'Brussels' },
  'ATH': { coords: [37.9364, 23.9445], city: 'Athens', state: 'GR', name: 'Eleftherios Venizelos' },
  'IST': { coords: [41.2753, 28.7519], city: 'Istanbul', state: 'TR', name: 'Istanbul' },
  'PRG': { coords: [50.1008, 14.2632], city: 'Prague', state: 'CZ', name: 'Vaclav Havel' },
  'WAW': { coords: [52.1657, 20.9671], city: 'Warsaw', state: 'PL', name: 'Chopin' },
  'BUD': { coords: [47.4298, 19.2611], city: 'Budapest', state: 'HU', name: 'Ferenc Liszt' },
  // Asia Major Airports
  'NRT': { coords: [35.7647, 140.3864], city: 'Tokyo', state: 'JP', name: 'Narita' },
  'HND': { coords: [35.5494, 139.7798], city: 'Tokyo', state: 'JP', name: 'Haneda' },
  'ICN': { coords: [37.4602, 126.4407], city: 'Seoul', state: 'KR', name: 'Incheon' },
  'HKG': { coords: [22.3080, 113.9185], city: 'Hong Kong', state: 'HK', name: 'Hong Kong Int.' },
  'SIN': { coords: [1.3644, 103.9915], city: 'Singapore', state: 'SG', name: 'Changi' },
  'PEK': { coords: [40.0799, 116.6031], city: 'Beijing', state: 'CN', name: 'Capital Int.' },
  'PVG': { coords: [31.1443, 121.8083], city: 'Shanghai', state: 'CN', name: 'Pudong Int.' },
  'BKK': { coords: [13.6900, 100.7501], city: 'Bangkok', state: 'TH', name: 'Suvarnabhumi' },
  'KUL': { coords: [2.7456, 101.7099], city: 'Kuala Lumpur', state: 'MY', name: 'Int. Airport' },
  'MNL': { coords: [14.5086, 121.0194], city: 'Manila', state: 'PH', name: 'Ninoy Aquino Int.' },
  'DEL': { coords: [28.5562, 77.1000], city: 'Delhi', state: 'IN', name: 'Indira Gandhi Int.' },
  'BOM': { coords: [19.0896, 72.8656], city: 'Mumbai', state: 'IN', name: 'Chhatrapati Shivaji' },
  'TPE': { coords: [25.0777, 121.2328], city: 'Taipei', state: 'TW', name: 'Taoyuan Int.' },
  'KIX': { coords: [34.4273, 135.2444], city: 'Osaka', state: 'JP', name: 'Kansai Int.' },
  'NGO': { coords: [34.8584, 136.8049], city: 'Nagoya', state: 'JP', name: 'Chubu Centrair' },
  'FUK': { coords: [33.5859, 130.4511], city: 'Fukuoka', state: 'JP', name: 'Fukuoka' },
  // Middle East Major Airports
  'DXB': { coords: [25.2532, 55.3657], city: 'Dubai', state: 'AE', name: 'Dubai Int.' },
  'AUH': { coords: [24.4330, 54.6511], city: 'Abu Dhabi', state: 'AE', name: 'Abu Dhabi Int.' },
  'DOH': { coords: [25.2731, 51.6080], city: 'Doha', state: 'QA', name: 'Hamad Int.' },
  'TLV': { coords: [32.0114, 34.8867], city: 'Tel Aviv', state: 'IL', name: 'Ben Gurion' },
  'CAI': { coords: [30.1219, 31.4056], city: 'Cairo', state: 'EG', name: 'Cairo Int.' },
  // South America Major Airports
  'GRU': { coords: [-23.4356, -46.4731], city: 'Sao Paulo', state: 'BR', name: 'Guarulhos' },
  'GIG': { coords: [-22.8099, -43.2505], city: 'Rio de Janeiro', state: 'BR', name: 'Galeao' },
  'EZE': { coords: [-34.8222, -58.5358], city: 'Buenos Aires', state: 'AR', name: 'Ministro Pistarini' },
  'SCL': { coords: [-33.3930, -70.7858], city: 'Santiago', state: 'CL', name: 'Arturo Merino Benitez' },
  'BOG': { coords: [4.7016, -74.1469], city: 'Bogota', state: 'CO', name: 'El Dorado Int.' },
  'LIM': { coords: [-12.0219, -77.1143], city: 'Lima', state: 'PE', name: 'Jorge Chavez Int.' },
  'PTY': { coords: [9.0714, -79.3834], city: 'Panama City', state: 'PA', name: 'Tocumen Int.' },
  // Australia & New Zealand
  'SYD': { coords: [-33.9399, 151.1753], city: 'Sydney', state: 'AU', name: 'Kingsford Smith' },
  'MEL': { coords: [-37.6690, 144.8410], city: 'Melbourne', state: 'AU', name: 'Melbourne' },
  'BNE': { coords: [-27.3842, 153.1175], city: 'Brisbane', state: 'AU', name: 'Brisbane' },
  'PER': { coords: [-31.9403, 115.9672], city: 'Perth', state: 'AU', name: 'Perth' },
  'AKL': { coords: [-37.0082, 174.7850], city: 'Auckland', state: 'NZ', name: 'Auckland' },
  'CHC': { coords: [-43.4894, 172.5320], city: 'Christchurch', state: 'NZ', name: 'Christchurch' },
}

export interface FlightRoute {
  fldrId: string
  fldrTitle: string
  dateStart: string
  segments: FlightSegment[]
  color: string
}

export interface JobLocation {
  fldrId: string
  fldrTitle: string
  dateStart: string
  location: string
  address: string | null
  color: string
}

export interface FlightGlobeProps {
  routes: FlightRoute[]
  locations: JobLocation[]
  selectedRouteId: string | null
}

export default function FlightGlobe({ routes, locations, selectedRouteId }: FlightGlobeProps) {
  const globeRef = useRef<HTMLDivElement>(null)
  const globeInstance = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [globeReady, setGlobeReady] = useState(false)

  // Force console log to appear
  if (typeof window !== 'undefined') {
    window.console.log('[FlightGlobe] Component called - routes:', routes?.length || 0, 'selectedRouteId:', selectedRouteId)
  }

  useEffect(() => {
    window.console.log('[FlightGlobe] Init useEffect triggered - globeRef:', !!globeRef.current)
    
    if (!globeRef.current) return

    console.log('[FlightGlobe] Initializing globe...')

    // Dynamic import to avoid SSR issues
    import('globe.gl').then((GlobeModule) => {
      const Globe = GlobeModule.default

      console.log('[FlightGlobe] Globe.gl loaded, creating instance...')

      try {
        // Initialize globe
        const globe = (Globe as any)()(globeRef.current!)
        
        globe
          .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
          .backgroundColor('#000000')
          .showAtmosphere(true)
          .atmosphereColor('#3a5683')
          .atmosphereAltitude(0.15)
          .width(globeRef.current!.clientWidth)
          .height(globeRef.current!.clientHeight)

        globeInstance.current = globe

        // Set initial camera position (centered on USA)
        globe.pointOfView({ lat: 39.8, lng: -98.5, altitude: 2.5 })

        console.log('[FlightGlobe] Globe initialized successfully')
        setLoading(false)
        setGlobeReady(true)

        // Handle window resize
        const handleResize = () => {
          if (globeRef.current && globeInstance.current) {
            globeInstance.current
              .width(globeRef.current.clientWidth)
              .height(globeRef.current.clientHeight)
          }
        }
        window.addEventListener('resize', handleResize)

        return () => {
          window.removeEventListener('resize', handleResize)
          if (globeInstance.current) {
            globeInstance.current._destructor?.()
          }
        }
      } catch (err) {
        console.error('[FlightGlobe] Error initializing globe:', err)
        setError('Failed to initialize globe')
        setLoading(false)
      }
    }).catch(err => {
      console.error('[FlightGlobe] Error loading globe.gl:', err)
      setError('Failed to load globe library')
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    window.console.log('[FlightGlobe] Routes useEffect triggered - routes:', routes?.length, 'globeInstance:', !!globeInstance.current)
    
    if (!globeInstance.current) {
      console.log('[FlightGlobe] Cannot update routes - globe not initialized yet')
      return
    }

    if (!routes || routes.length === 0) {
      console.log('[FlightGlobe] No routes data yet, skipping update')
      return
    }

    console.log('[FlightGlobe] Updating routes...', { totalRoutes: routes.length, selectedRouteId })

    // Filter routes if one is selected
    const displayRoutes = selectedRouteId 
      ? routes.filter(r => r.fldrId === selectedRouteId) 
      : routes

    console.log('[FlightGlobe] Display routes count:', displayRoutes.length)

    // Build arcs data for flight routes
    const arcsData: any[] = []
    const pointsData: any[] = []
    const uniqueAirports = new Set<string>()

    displayRoutes.forEach(route => {
      console.log('[FlightGlobe] Processing route:', route.fldrTitle, 'segments:', route.segments.length)
      route.segments.forEach(segment => {
        const depCode = segment.departure_code
        const arrCode = segment.arrival_code

        if (!depCode || !arrCode) {
          console.warn('[FlightGlobe] Missing airport code:', { depCode, arrCode })
          return
        }
        if (!AIRPORT_INFO[depCode]) {
          console.warn('[FlightGlobe] Airport not in database:', depCode)
          return
        }
        if (!AIRPORT_INFO[arrCode]) {
          console.warn('[FlightGlobe] Airport not in database:', arrCode)
          return
        }

        const depInfo = AIRPORT_INFO[depCode]
        const arrInfo = AIRPORT_INFO[arrCode]

        // Add arc
        arcsData.push({
          startLat: depInfo.coords[0],
          startLng: depInfo.coords[1],
          endLat: arrInfo.coords[0],
          endLng: arrInfo.coords[1],
          color: route.color,
          label: `${route.fldrTitle}: ${depCode} → ${arrCode}`
        })

        // Track airports for points
        uniqueAirports.add(depCode)
        uniqueAirports.add(arrCode)
      })
    })

    console.log('[FlightGlobe] Created', arcsData.length, 'arcs and', uniqueAirports.size, 'unique airports')

    // Add airport points
    uniqueAirports.forEach(code => {
      const info = AIRPORT_INFO[code]
      if (info) {
        pointsData.push({
          lat: info.coords[0],
          lng: info.coords[1],
          label: `${code} - ${info.city}, ${info.state}`,
          size: 0.15,
          color: '#E8B44D'
        })
      }
    })

    // Update globe with arcs and points
    try {
      globeInstance.current
        .arcsData(arcsData)
        .arcColor('color')
        .arcDashLength(0.6)
        .arcDashGap(0.2)
        .arcDashAnimateTime(5000)
        .arcStroke(0.15)
        .arcAltitudeAutoScale(0.3)
        .arcLabel('label')
        .pointsData(pointsData)
        .pointColor('color')
        .pointAltitude(0)
        .pointRadius('size')
        .pointResolution(8)
        .pointLabel('label')
      
      console.log('[FlightGlobe] Globe updated successfully')
    } catch (err) {
      console.error('[FlightGlobe] Error updating globe:', err)
    }

  }, [routes, selectedRouteId, globeReady])

  return (
    <div className="relative w-full h-full">
      <div ref={globeRef} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-white/60">Loading globe...</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-red-400">{error}</div>
        </div>
      )}
    </div>
  )
}
