// No Google API keys needed — maps use OpenStreetMap tiles,
// routing uses Transitous (MOTIS), geocoding uses Photon.
module.exports = ({ config }) => {
    return {
        ...config,
    };
};
