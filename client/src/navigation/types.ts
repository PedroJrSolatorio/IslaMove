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
  AdminHome: undefined;
  DriverHome: undefined;
  PassengerHome: undefined;
  MapLocationPicker: {
    onLocationSelected: (location: Location) => void;
  };
};
