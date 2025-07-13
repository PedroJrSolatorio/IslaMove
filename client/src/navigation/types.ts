interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
  mainText?: string;
  secondaryText?: string;
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
    callbackId: string;
    preselectedLocation?: Location;
  };
};
