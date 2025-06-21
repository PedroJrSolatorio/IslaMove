interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
}

export type RootStackParamList = {
  Login: undefined;
  RegisterSelection: undefined;
  RegisterDriver: undefined;
  RegisterPassenger: undefined;
  MapLocationPicker: {
    onLocationSelected: (location: Location) => void;
  };
  // AdminHome: undefined; to be checked if i really need this
  // DriverHome: undefined;
  // PassengerHome: undefined;
  // BookRide: undefined;
};
